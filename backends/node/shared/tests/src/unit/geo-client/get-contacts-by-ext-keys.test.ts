import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import {
  GetContactsByExtKeys,
  DEFAULT_GEO_CLIENT_OPTIONS,
  GEO_CACHE_KEYS,
  type GeoClientOptions,
} from "@d2/geo-client";

import type { GeoServiceClient, ContactDTO } from "@d2/protos";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockContactDTO(
  id: string,
  contextKey = "auth_org_contact",
  relatedEntityId = "related-1",
): ContactDTO {
  return {
    id,
    createdAt: new Date("2026-02-10"),
    contextKey,
    relatedEntityId,
    personalDetails: { firstName: "Test" },
  } as ContactDTO;
}

function mockGrpcMethod<TReq, TRes>(response: TRes) {
  return vi.fn(
    (_req: TReq, _meta: unknown, _opts: unknown, cb: (err: Error | null, res: TRes) => void) => {
      cb(null, response);
    },
  );
}

function mockGrpcMethodError<TReq, TRes>(error: Error) {
  return vi.fn(
    (_req: TReq, _meta: unknown, _opts: unknown, cb: (err: Error | null, res: TRes) => void) => {
      cb(error, undefined as never);
    },
  );
}

describe("GetContactsByExtKeys handler", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ maxEntries: 100 });
  });

  it("should return all contacts from cache without gRPC call", async () => {
    const contacts1 = [createMockContactDTO("c-1", "auth_org_contact", "org-1")];
    const contacts2 = [createMockContactDTO("c-2", "auth_org_contact", "org-2")];
    store.set(GEO_CACHE_KEYS.contactsByExtKey("auth_org_contact", "org-1"), contacts1);
    store.set(GEO_CACHE_KEYS.contactsByExtKey("auth_org_contact", "org-2"), contacts2);

    const mockGeoClient = { getContactsByExtKeys: vi.fn() } as unknown as GeoServiceClient;
    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("auth_org_contact:org-1")).toEqual(contacts1);
    expect(result.data?.data.get("auth_org_contact:org-2")).toEqual(contacts2);
    expect(mockGeoClient.getContactsByExtKeys).not.toHaveBeenCalled();
  });

  it("should call gRPC for all keys on complete cache miss", async () => {
    const contact1 = createMockContactDTO("c-1", "auth_org_contact", "org-1");
    const contact2 = createMockContactDTO("c-2", "auth_org_contact", "org-2");

    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
            contacts: [contact1],
          },
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
            contacts: [contact2],
          },
        ],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("auth_org_contact:org-1")).toEqual([contact1]);
    expect(result.data?.data.get("auth_org_contact:org-2")).toEqual([contact2]);
    expect(mockGeoClient.getContactsByExtKeys).toHaveBeenCalledOnce();
  });

  it("should call gRPC for cache misses only (partial cache)", async () => {
    const cachedContacts = [createMockContactDTO("c-cached", "auth_org_contact", "org-1")];
    store.set(GEO_CACHE_KEYS.contactsByExtKey("auth_org_contact", "org-1"), cachedContacts);

    const fetchedContact = createMockContactDTO("c-fetched", "auth_org_contact", "org-2");
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
            contacts: [fetchedContact],
          },
        ],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("auth_org_contact:org-1")).toEqual(cachedContacts);
    expect(result.data?.data.get("auth_org_contact:org-2")).toEqual([fetchedContact]);

    // Should only request the missing key
    const grpcRequest = vi.mocked(mockGeoClient.getContactsByExtKeys).mock.calls[0][0];
    expect(grpcRequest.keys).toEqual([
      { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
    ]);
  });

  it("should fail-open: return cached data when gRPC fails", async () => {
    const cachedContacts = [createMockContactDTO("c-cached", "auth_org_contact", "org-1")];
    store.set(GEO_CACHE_KEYS.contactsByExtKey("auth_org_contact", "org-1"), cachedContacts);

    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-missing" },
      ],
    });

    // Fail-open: returns whatever was cached
    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(1);
    expect(result.data?.data.get("auth_org_contact:org-1")).toEqual(cachedContacts);
    expect(result.data?.data.has("auth_org_contact:org-missing")).toBe(false);
  });

  it("should return empty Map for empty keys input", async () => {
    const mockGeoClient = { getContactsByExtKeys: vi.fn() } as unknown as GeoServiceClient;
    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({ keys: [] });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(0);
    expect(mockGeoClient.getContactsByExtKeys).not.toHaveBeenCalled();
  });

  it("should populate ext-key cache after gRPC fetch", async () => {
    const contact = createMockContactDTO("c-new", "auth_org_contact", "org-1");
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
            contacts: [contact],
          },
        ],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      keys: [{ contextKey: "auth_org_contact", relatedEntityId: "org-1" }],
    });

    // Verify it was cached with the correct ext-key format
    expect(store.get(GEO_CACHE_KEYS.contactsByExtKey("auth_org_contact", "org-1"))).toEqual([
      contact,
    ]);
  });

  it("should return validation error when context key is not in allowedContextKeys", async () => {
    const mockGeoClient = {
      getContactsByExtKeys: vi.fn(),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["auth_org_contact"],
    };

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      restrictedOptions,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "not_allowed", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.inputErrors).toBeDefined();
    expect(result.inputErrors!.length).toBeGreaterThan(0);
    expect(mockGeoClient.getContactsByExtKeys).not.toHaveBeenCalled();
  });

  it("should return empty Map when gRPC response has no data entries", async () => {
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "auth_org_contact", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(0);
  });

  it("should return empty Map when gRPC result indicates failure (fail-open)", async () => {
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: false,
          statusCode: 500,
          messages: ["Error"],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "auth_org_contact", relatedEntityId: "org-1" }],
    });

    // Non-success result means data isn't processed — fail-open returns success with empty map
    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(0);
  });

  it("should allow request when context key is in allowedContextKeys", async () => {
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [],
      }),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["auth_org_contact"],
    };

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      restrictedOptions,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "auth_org_contact", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.getContactsByExtKeys).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // Cross-handler cache coherence: GetContactsByExtKeys ↔ DeleteContactsByExtKeys
  // ---------------------------------------------------------------------------

  it("cache entries populated by GetContactsByExtKeys should be evicted by DeleteContactsByExtKeys", async () => {
    // Step 1: Populate cache via GetContactsByExtKeys (simulating a gRPC fetch)
    const contact1 = createMockContactDTO("c-1", "auth_org_contact", "org-1");
    const contact2 = createMockContactDTO("c-2", "auth_org_contact", "org-2");
    const contact3 = createMockContactDTO("c-3", "auth_org_contact", "org-3");

    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
            contacts: [contact1],
          },
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
            contacts: [contact2],
          },
          {
            key: { contextKey: "auth_org_contact", relatedEntityId: "org-3" },
            contacts: [contact3],
          },
        ],
      }),
      deleteContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        deleted: 2,
      }),
    } as unknown as GeoServiceClient;

    const getHandler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await getHandler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-3" },
      ],
    });

    // Verify all three are cached with the correct key format
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-1")).toEqual([contact1]);
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-2")).toEqual([contact2]);
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-3")).toEqual([contact3]);

    // Step 2: Delete org-1 and org-2 via DeleteContactsByExtKeys
    const { DeleteContactsByExtKeys } = await import("@d2/geo-client");
    const deleteHandler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await deleteHandler.handleAsync({
      keys: [
        { contextKey: "auth_org_contact", relatedEntityId: "org-1" },
        { contextKey: "auth_org_contact", relatedEntityId: "org-2" },
      ],
    });

    // org-1 and org-2 evicted, org-3 remains — proving both handlers use the same key format
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-1")).toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-2")).toBeUndefined();
    expect(store.get("geo:contacts-by-extkey:auth_org_contact:org-3")).toEqual([contact3]);
  });

  it("cache entries populated by GetContactsByExtKeys should be evicted by ContactsEvicted handler", async () => {
    // Step 1: Populate cache via GetContactsByExtKeys
    const contact = createMockContactDTO("c-ev", "auth_user", "user-ev");

    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          {
            key: { contextKey: "auth_user", relatedEntityId: "user-ev" },
            contacts: [contact],
          },
        ],
      }),
    } as unknown as GeoServiceClient;

    const getHandler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await getHandler.handleAsync({
      keys: [{ contextKey: "auth_user", relatedEntityId: "user-ev" }],
    });

    expect(store.get("geo:contacts-by-extkey:auth_user:user-ev")).toEqual([contact]);

    // Step 2: Evict via ContactsEvicted messaging handler
    const { ContactsEvicted } = await import("@d2/geo-client");
    const evictHandler = new ContactsEvicted(store, createTestContext());
    await evictHandler.handleAsync({
      contacts: [{ contactId: "c-ev", contextKey: "auth_user", relatedEntityId: "user-ev" }],
    });

    // Both cache key formats should be evicted
    expect(store.get("geo:contacts-by-extkey:auth_user:user-ev")).toBeUndefined();
  });

  it("should skip allowedContextKeys validation when list is empty", async () => {
    const mockGeoClient = {
      getContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [],
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "any_key", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.getContactsByExtKeys).toHaveBeenCalledOnce();
  });
});
