import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import type { Commands } from "@d2/geo-client";
import type {
  IFindOrgContactByIdHandler,
  IDeleteOrgContactRecordHandler,
} from "../../../../interfaces/repository/handlers/index.js";

export interface DeleteOrgContactInput {
  readonly id: string;
  readonly organizationId: string;
}

export type DeleteOrgContactOutput = Record<string, never>;

const schema = z.object({
  id: zodGuid,
  organizationId: zodGuid,
});

/**
 * Deletes an org contact junction record and its associated Geo contact.
 *
 * Validates input, checks existence, verifies IDOR (contact belongs to org),
 * deletes the Geo contact by ext key (best-effort), then deletes the junction.
 */
export class DeleteOrgContact extends BaseHandler<DeleteOrgContactInput, DeleteOrgContactOutput> {
  private readonly findById: IFindOrgContactByIdHandler;
  private readonly deleteRecord: IDeleteOrgContactRecordHandler;
  private readonly deleteContactsByExtKeys: Commands.IDeleteContactsByExtKeysHandler;

  constructor(
    findById: IFindOrgContactByIdHandler,
    deleteRecord: IDeleteOrgContactRecordHandler,
    context: IHandlerContext,
    deleteContactsByExtKeys: Commands.IDeleteContactsByExtKeysHandler,
  ) {
    super(context);
    this.findById = findById;
    this.deleteRecord = deleteRecord;
    this.deleteContactsByExtKeys = deleteContactsByExtKeys;
  }

  protected async executeAsync(
    input: DeleteOrgContactInput,
  ): Promise<D2Result<DeleteOrgContactOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.findById.handleAsync({ id: input.id });
    if (!findResult.success || !findResult.data) {
      return D2Result.notFound({ traceId: this.traceId });
    }

    const existing = findResult.data.contact;

    // IDOR check: contact must belong to the caller's active org
    if (existing.organizationId !== input.organizationId) {
      return D2Result.fail({
        messages: ["Not authorized to delete this contact."],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
        traceId: this.traceId,
      });
    }

    // Best-effort: delete the associated Geo contact by ext key.
    // If this fails, Geo's background job handles orphan cleanup.
    try {
      await this.deleteContactsByExtKeys.handleAsync({
        keys: [{ contextKey: "org_contact", relatedEntityId: existing.id }],
      });
    } catch {
      // Swallow — Geo cleanup is non-critical
    }

    // Delete the junction record
    const deleteResult = await this.deleteRecord.handleAsync({ id: input.id });
    if (!deleteResult.success) return D2Result.bubbleFail(deleteResult);

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
