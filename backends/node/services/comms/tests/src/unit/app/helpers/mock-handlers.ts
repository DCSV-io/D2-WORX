import { vi } from "vitest";
import { D2Result } from "@d2/result";
import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
  IEmailProvider,
} from "@d2/comms-app";
import type { IHandlerContext } from "@d2/handler";

/** Creates a mock handler that returns D2Result.ok with the given data. */
function okHandler<I, O>(data: O = {} as O) {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data })),
  };
}

/** Creates a mock IHandlerContext. */
export function createMockContext(): IHandlerContext {
  return {
    request: { traceId: "test-trace-id" },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as IHandlerContext;
}

/** Creates mock MessageRepoHandlers. */
export function createMockMessageRepo(): MessageRepoHandlers {
  return {
    create: okHandler(),
    findById: okHandler({ message: null }),
  };
}

/** Creates mock DeliveryRequestRepoHandlers. */
export function createMockRequestRepo(): DeliveryRequestRepoHandlers {
  return {
    create: okHandler(),
    findById: okHandler({ request: null }),
    findByCorrelationId: okHandler({ request: null }),
    markProcessed: okHandler(),
  };
}

/** Creates mock DeliveryAttemptRepoHandlers. */
export function createMockAttemptRepo(): DeliveryAttemptRepoHandlers {
  return {
    create: okHandler(),
    findByRequestId: okHandler({ attempts: [] }),
    updateStatus: okHandler(),
  };
}

/** Creates mock ChannelPreferenceRepoHandlers. */
export function createMockChannelPrefRepo(): ChannelPreferenceRepoHandlers {
  return {
    create: okHandler(),
    findByContactId: okHandler({ pref: null }),
    update: okHandler(),
  };
}

/** Creates a mock IEmailProvider. */
export function createMockEmailProvider(): IEmailProvider {
  return {
    handleAsync: vi
      .fn()
      .mockResolvedValue(D2Result.ok({ data: { providerMessageId: "resend-msg-123" } })),
  } as unknown as IEmailProvider;
}

/** Creates a mock GetContactsByIds handler. */
export function createMockGetContactsByIds() {
  const contacts = new Map();
  contacts.set("contact-1", {
    id: "contact-1",
    contextKey: "auth_user",
    relatedEntityId: "user-123",
    contactMethods: {
      emails: [{ value: "user@example.com", labels: [] }],
      phoneNumbers: [{ value: "+15551234567", labels: [] }],
    },
    personalDetails: undefined,
    professionalDetails: undefined,
    location: undefined,
    createdAt: new Date(),
  });

  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
  };
}
