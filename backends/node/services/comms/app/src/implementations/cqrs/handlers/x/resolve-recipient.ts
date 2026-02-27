import { z } from "zod";
import { BaseHandler, type IHandlerContext, type RedactionSpec, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { Queries } from "@d2/geo-client";

const resolveRecipientSchema = z.object({
  contactId: zodGuid,
});

export interface ResolveRecipientInput {
  readonly contactId: string;
}

export interface ResolveRecipientOutput {
  readonly email?: string;
  readonly phone?: string;
}

/**
 * Resolves a recipient's email/phone from their contactId.
 *
 * Uses GetContactsByIds (direct Geo contact ID lookup).
 * Uses geo-client's built-in LRU caching — contacts are immutable,
 * so no additional cache layer is needed.
 */
export class RecipientResolver extends BaseHandler<ResolveRecipientInput, ResolveRecipientOutput> {
  private readonly getContactsByIds: Queries.IGetContactsByIdsHandler;

  get redaction(): RedactionSpec {
    return { outputFields: ["email", "phone"] };
  }

  constructor(getContactsByIds: Queries.IGetContactsByIdsHandler, context: IHandlerContext) {
    super(context);
    this.getContactsByIds = getContactsByIds;
  }

  protected async executeAsync(
    input: ResolveRecipientInput,
  ): Promise<D2Result<ResolveRecipientOutput | undefined>> {
    const validation = this.validateInput(resolveRecipientSchema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const result = await this.getContactsByIds.handleAsync({
      ids: [input.contactId],
    });

    if (!result.success || !result.data) {
      return D2Result.bubbleFail(result);
    }

    const contact = result.data.data.get(input.contactId);
    const contacts = contact ? [contact] : [];

    if (contacts.length === 0) {
      return D2Result.ok({ data: {} });
    }

    // Extract email and phone from contacts' methods (ContactDTO -> ContactMethodsDTO)
    let email: string | undefined;
    let phone: string | undefined;

    for (const c of contacts) {
      const methods = c.contactMethods;
      if (!methods) continue;

      const firstEmail = methods.emails[0];
      if (!email && firstEmail) {
        email = firstEmail.value;
      }
      const firstPhone = methods.phoneNumbers[0];
      if (!phone && firstPhone) {
        phone = firstPhone.value;
      }
      if (email && phone) break;
    }

    return D2Result.ok({ data: { email, phone } });
  }
}
