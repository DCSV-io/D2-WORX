import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import {
  updateOrgContact,
  GEO_CONTEXT_KEYS,
  type OrgContact,
  type UpdateOrgContactInput,
} from "@d2/auth-domain";
import type { ContactDTO, ContactToCreateDTO } from "@d2/protos";
import { contactInputSchema, type Complex } from "@d2/geo-client";
import type {
  IFindOrgContactByIdHandler,
  IUpdateOrgContactRecordHandler,
} from "../../../../interfaces/repository/handlers/index.js";
import type { ContactInput } from "./create-org-contact.js";

export interface UpdateOrgContactHandlerInput {
  readonly id: string;
  readonly organizationId: string;
  readonly updates: UpdateOrgContactInput & {
    /** If provided, triggers contact replacement via UpdateContactsByExtKeys. */
    readonly contact?: ContactInput;
  };
}

export type UpdateOrgContactOutput = {
  contact: OrgContact;
  geoContact?: ContactDTO;
};

const schema = z.object({
  id: zodGuid,
  organizationId: zodGuid,
  updates: z
    .object({
      label: z.string().max(100).optional(),
      isPrimary: z.boolean().optional(),
      contact: contactInputSchema.optional(),
    })
    .refine(
      (u) => u.label !== undefined || u.isPrimary !== undefined || u.contact !== undefined,
      "At least one field (label, isPrimary, or contact) must be provided.",
    ),
});

/**
 * Updates an existing org contact junction record.
 *
 * Two modes:
 * 1. **Metadata-only** (label and/or isPrimary) — updates junction fields in place.
 * 2. **Contact replacement** (contact details provided) — calls UpdateContactsByExtKeys
 *    which atomically replaces the Geo contact at the ext key. Then updates junction metadata.
 */
export class UpdateOrgContactHandler extends BaseHandler<
  UpdateOrgContactHandlerInput,
  UpdateOrgContactOutput
> {
  private readonly findById: IFindOrgContactByIdHandler;
  private readonly updateRecord: IUpdateOrgContactRecordHandler;
  private readonly updateContactsByExtKeys: Complex.IUpdateContactsByExtKeysHandler;

  constructor(
    findById: IFindOrgContactByIdHandler,
    updateRecord: IUpdateOrgContactRecordHandler,
    context: IHandlerContext,
    updateContactsByExtKeys: Complex.IUpdateContactsByExtKeysHandler,
  ) {
    super(context);
    this.findById = findById;
    this.updateRecord = updateRecord;
    this.updateContactsByExtKeys = updateContactsByExtKeys;
  }

  protected async executeAsync(
    input: UpdateOrgContactHandlerInput,
  ): Promise<D2Result<UpdateOrgContactOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.findById.handleAsync({ id: input.id });
    if (!findResult.success || !findResult.data) {
      return D2Result.notFound();
    }

    const existing = findResult.data.contact;

    // IDOR check: contact must belong to the caller's active org
    if (existing.organizationId !== input.organizationId) {
      return D2Result.fail({
        messages: ["Not authorized to modify this contact."],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    let newGeoContact: ContactDTO | undefined;

    // Contact replacement flow — single call to Geo
    if (input.updates.contact) {
      const contactToCreate = {
        createdAt: new Date(),
        contextKey: GEO_CONTEXT_KEYS.ORG_CONTACT,
        relatedEntityId: existing.id,
        contactMethods: input.updates.contact.contactMethods ?? undefined,
        personalDetails: input.updates.contact.personalDetails ?? undefined,
        professionalDetails: input.updates.contact.professionalDetails ?? undefined,
        location: input.updates.contact.location ?? undefined,
      } as ContactToCreateDTO;

      const geoResult = await this.updateContactsByExtKeys.handleAsync({
        contacts: [contactToCreate],
      });
      if (!geoResult.success || !geoResult.data) {
        return D2Result.bubbleFail(geoResult);
      }

      newGeoContact = geoResult.data.data[0];
      if (!newGeoContact) {
        return D2Result.bubbleFail(geoResult);
      }
    }

    // Apply metadata updates via domain function
    const metadataUpdates: UpdateOrgContactInput = {};
    if (input.updates.label !== undefined) {
      (metadataUpdates as Record<string, unknown>).label = input.updates.label;
    }
    if (input.updates.isPrimary !== undefined) {
      (metadataUpdates as Record<string, unknown>).isPrimary = input.updates.isPrimary;
    }

    const updated = updateOrgContact(existing, metadataUpdates);
    const updateResult = await this.updateRecord.handleAsync({ contact: updated });
    if (!updateResult.success) return D2Result.bubbleFail(updateResult);

    return D2Result.ok({
      data: { contact: updated, geoContact: newGeoContact },
    });
  }
}
