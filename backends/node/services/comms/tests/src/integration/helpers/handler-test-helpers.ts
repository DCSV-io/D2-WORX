import { D2Result } from "@d2/result";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { generateUuidV7 } from "@d2/utilities";
import type { SendEmailInput, SendEmailOutput, IEmailProvider } from "@d2/comms-app";
import type { Queries } from "@d2/geo-client";
import type { ContactDTO } from "@d2/protos";

// ---------------------------------------------------------------------------
// Stub Email Provider
// ---------------------------------------------------------------------------

interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  plainText?: string;
  providerMessageId: string;
}

/**
 * Stub email provider for integration tests. Captures all sent emails in memory.
 * Mirrors the E2E StubEmailProvider but lives in the test project.
 */
export class StubEmailProvider
  extends BaseHandler<SendEmailInput, SendEmailOutput>
  implements IEmailProvider
{
  private readonly emails: CapturedEmail[] = [];

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(
    input: SendEmailInput,
  ): Promise<D2Result<SendEmailOutput | undefined>> {
    const providerMessageId = `stub-${generateUuidV7()}`;
    this.emails.push({
      to: input.to,
      subject: input.subject,
      html: input.html,
      plainText: input.plainText,
      providerMessageId,
    });
    return D2Result.ok({ data: { providerMessageId } });
  }

  getSentEmails(): readonly CapturedEmail[] {
    return this.emails;
  }

  getLastEmail(): CapturedEmail | undefined {
    return this.emails.at(-1);
  }

  sentCount(): number {
    return this.emails.length;
  }

  clear(): void {
    this.emails.length = 0;
  }
}

export type { StubEmailProvider as StubEmailProviderType };

export function createStubEmailProvider(context: IHandlerContext): StubEmailProvider {
  return new StubEmailProvider(context);
}

// ---------------------------------------------------------------------------
// Mock Geo Handlers
// ---------------------------------------------------------------------------

/**
 * Mock geo-client handlers for integration tests.
 *
 * Provides `getContactsByIds` that returns pre-configured contact data.
 * This avoids the need for a running Geo service while still testing
 * the real Deliver handler + RecipientResolver.
 */
export interface MockGeoHandlers {
  getContactsByIds: Queries.IGetContactsByIdsHandler;
  /** Register a contactId -> email mapping for the contactId path. */
  setContactEmail(contactId: string, email: string, phone?: string): void;
  /** Clear all registered contacts. */
  reset(): void;
}

export function createMockGeoHandlers(): MockGeoHandlers {
  // contactId -> contact data (for GetContactsByIds)
  const idContacts = new Map<string, ContactDTO>();

  function makeContact(contactId: string, email: string, phone?: string): ContactDTO {
    return {
      id: contactId,
      firstName: "Test",
      lastName: "User",
      contactMethods: {
        emails: [{ value: email, label: "primary", isPrimary: true }],
        phoneNumbers: phone
          ? [{ value: phone, label: "mobile", isPrimary: true }]
          : [],
        addresses: [],
      },
      locationId: "",
      contextKey: "",
      relatedEntityId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as ContactDTO;
  }

  const getContactsByIds: Queries.IGetContactsByIdsHandler = {
    handleAsync: async (input: { ids: string[] }) => {
      const data = new Map<string, ContactDTO>();
      for (const id of input.ids) {
        const contact = idContacts.get(id);
        if (contact) {
          data.set(id, contact);
        }
      }
      return D2Result.ok({ data: { data } });
    },
  } as unknown as Queries.IGetContactsByIdsHandler;

  return {
    getContactsByIds,
    setContactEmail(contactId: string, email: string, phone?: string) {
      idContacts.set(contactId, makeContact(contactId, email, phone));
    },
    reset() {
      idContacts.clear();
    },
  };
}
