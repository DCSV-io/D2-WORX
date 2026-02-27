import { describe, it, expect, vi } from "vitest";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import type { ILogger } from "@d2/logging";
import { MemoryCacheStore } from "@d2/cache-memory";
import { ContactsEvicted } from "@d2/geo-client";
import type { ContactsEvictedEvent } from "@d2/protos";

function createMockLogger(): ILogger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger;
}

function createTestContext(logger?: ILogger): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, logger ?? createMockLogger());
}

describe("ContactsEvicted messaging handler", () => {
  it("should evict contacts by ID and ext-key from cache", async () => {
    const store = new MemoryCacheStore({ maxEntries: 100 });
    store.set("geo:contact:abc-111", { name: "Alice" });
    store.set("geo:contacts-by-extkey:auth_user:user-001", { name: "Alice ext" });
    store.set("geo:contact:abc-222", { name: "Bob" });
    store.set("geo:contacts-by-extkey:auth_org_contact:org-001", { name: "Bob ext" });
    store.set("geo:contact:abc-333", { name: "Charlie" });

    const handler = new ContactsEvicted(store, createTestContext());
    const input: ContactsEvictedEvent = {
      contacts: [
        { contactId: "abc-111", contextKey: "auth_user", relatedEntityId: "user-001" },
        { contactId: "abc-222", contextKey: "auth_org_contact", relatedEntityId: "org-001" },
      ],
    };

    const result = await handler.handleAsync(input);

    expect(result).toBeSuccess();
    expect(store.get("geo:contact:abc-111")).toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_user:user-001")).toBeUndefined();
    expect(store.get("geo:contact:abc-222")).toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-001")).toBeUndefined();
    // Untouched entry remains
    expect(store.get("geo:contact:abc-333")).not.toBeUndefined();
  });

  it("should evict both cache keys for each contact entry", async () => {
    const store = new MemoryCacheStore({ maxEntries: 100 });
    store.set("geo:contact:abc-111", { name: "Alice" });
    store.set("geo:contacts-by-extkey:auth_user:user-001", { name: "Alice ext" });
    store.set("geo:contact:abc-999", { name: "Charlie" });
    store.set("geo:contacts-by-extkey:auth_user:user-999", { name: "Diana" });

    const handler = new ContactsEvicted(store, createTestContext());
    const input: ContactsEvictedEvent = {
      contacts: [{ contactId: "abc-111", contextKey: "auth_user", relatedEntityId: "user-001" }],
    };

    const result = await handler.handleAsync(input);

    expect(result).toBeSuccess();
    expect(store.get("geo:contact:abc-111")).toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_user:user-001")).toBeUndefined();
    // Untouched entries remain
    expect(store.get("geo:contact:abc-999")).not.toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_user:user-999")).not.toBeUndefined();
    expect(store.size).toBe(2);
  });

  it("should succeed with empty contacts array", async () => {
    const store = new MemoryCacheStore({ maxEntries: 100 });
    store.set("geo:contact:abc-111", { name: "Alice" });

    const handler = new ContactsEvicted(store, createTestContext());
    const input: ContactsEvictedEvent = {
      contacts: [],
    };

    const result = await handler.handleAsync(input);

    expect(result).toBeSuccess();
    // Nothing should have been evicted
    expect(store.get("geo:contact:abc-111")).not.toBeUndefined();
    expect(store.size).toBe(1);
  });

  it("should log eviction summary", async () => {
    const store = new MemoryCacheStore({ maxEntries: 100 });
    store.set("geo:contact:abc-111", { name: "Alice" });
    store.set("geo:contacts-by-extkey:auth_user:user-001", { name: "Bob" });

    const logger = createMockLogger();
    const handler = new ContactsEvicted(store, createTestContext(logger));
    const input: ContactsEvictedEvent = {
      contacts: [
        { contactId: "abc-111", contextKey: "auth_user", relatedEntityId: "user-001" },
        { contactId: "abc-222", contextKey: "auth_org_contact", relatedEntityId: "org-001" },
      ],
    };

    await handler.handleAsync(input);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("2 contact(s)"));
  });
});
