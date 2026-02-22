import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ContactDTO } from "@d2/protos";
import type { Queries } from "@d2/geo-client";
import { GEO_CONTEXT_KEYS } from "@d2/auth-domain";

export interface ResolveRecipientInput {
  readonly userId?: string;
  readonly contactId?: string;
}

export interface ResolveRecipientOutput {
  readonly email?: string;
  readonly phone?: string;
}

/**
 * Resolves a recipient's email/phone from their userId or contactId.
 *
 * - userId path: Uses GetContactsByExtKeys (contextKey: "auth_user")
 * - contactId path: Uses GetContactsByIds (direct Geo contact ID lookup)
 *
 * Uses geo-client's built-in LRU caching — contacts are immutable,
 * so no additional cache layer is needed.
 */
export class RecipientResolver extends BaseHandler<ResolveRecipientInput, ResolveRecipientOutput> {
  private readonly getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler;
  private readonly getContactsByIds: Queries.IGetContactsByIdsHandler;

  constructor(
    getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler,
    getContactsByIds: Queries.IGetContactsByIdsHandler,
    context: IHandlerContext,
  ) {
    super(context);
    this.getContactsByExtKeys = getContactsByExtKeys;
    this.getContactsByIds = getContactsByIds;
  }

  protected async executeAsync(
    input: ResolveRecipientInput,
  ): Promise<D2Result<ResolveRecipientOutput | undefined>> {
    if (!input.userId && !input.contactId) {
      return D2Result.ok({ data: {} });
    }

    let contacts: ContactDTO[];

    if (input.userId) {
      // User path: resolve via ext-key (contextKey: "auth_user", relatedEntityId: userId)
      const result = await this.getContactsByExtKeys.handleAsync({
        keys: [{ contextKey: GEO_CONTEXT_KEYS.USER, relatedEntityId: input.userId }],
      });

      if (!result.success || !result.data) {
        return D2Result.ok({ data: {} });
      }

      const lookupKey = `${GEO_CONTEXT_KEYS.USER}:${input.userId}`;
      contacts = result.data.data.get(lookupKey) ?? [];
    } else {
      // ContactId path: resolve via direct Geo contact ID
      const result = await this.getContactsByIds.handleAsync({
        ids: [input.contactId!],
      });

      if (!result.success || !result.data) {
        return D2Result.ok({ data: {} });
      }

      const contact = result.data.data.get(input.contactId!);
      contacts = contact ? [contact] : [];
    }

    if (contacts.length === 0) {
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
