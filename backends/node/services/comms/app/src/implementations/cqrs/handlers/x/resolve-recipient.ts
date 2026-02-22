import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { Queries } from "@d2/geo-client";

export interface ResolveRecipientInput {
  readonly userId?: string;
  readonly contactId?: string;
}

export interface ResolveRecipientOutput {
  readonly email?: string;
  readonly phone?: string;
}

/**
 * Resolves a recipient's email/phone from their userId or contactId
 * using geo-client's GetContactsByExtKeys.
 *
 * Uses geo-client's built-in LRU caching — contacts are immutable,
 * so no additional cache layer is needed.
 */
export class RecipientResolver extends BaseHandler<ResolveRecipientInput, ResolveRecipientOutput> {
  private readonly getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler;

  constructor(
    getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler,
    context: IHandlerContext,
  ) {
    super(context);
    this.getContactsByExtKeys = getContactsByExtKeys;
  }

  protected async executeAsync(
    input: ResolveRecipientInput,
  ): Promise<D2Result<ResolveRecipientOutput | undefined>> {
    if (!input.userId && !input.contactId) {
      return D2Result.ok({ data: {} });
    }

    const contextKey = input.userId ? "user" : "org_contact";
    const relatedEntityId = (input.userId ?? input.contactId)!;

    const result = await this.getContactsByExtKeys.handleAsync({
      keys: [{ contextKey, relatedEntityId }],
    });

    if (!result.success || !result.data) {
      return D2Result.ok({ data: {} });
    }

    const lookupKey = `${contextKey}:${relatedEntityId}`;
    const contacts = result.data.data.get(lookupKey);

    if (!contacts || contacts.length === 0) {
      return D2Result.ok({ data: {} });
    }

    // Extract email and phone from contacts' methods (ContactDTO → ContactMethodsDTO)
    let email: string | undefined;
    let phone: string | undefined;

    for (const contact of contacts) {
      const methods = contact.contactMethods;
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
