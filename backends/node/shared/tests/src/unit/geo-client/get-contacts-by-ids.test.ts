import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { GetContactsByIds } from "@d2/geo-client";

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

function createMockContactDTO(id: string): ContactDTO {
  return {
    id,
    createdAt: new Date("2026-02-10"),
    contextKey: "auth_user",
    relatedEntityId: "related-1",
    personalDetails: { firstName: "Test" },
  } as ContactDTO;
}

function mockGrpcMethod<TReq, TRes>(response: TRes) {
  return vi.fn((_req: TReq, cb: (err: Error | null, res: TRes) => void) => {
    cb(null, response);
  });
}

function mockGrpcMethodError<TReq, TRes>(error: Error) {
  return vi.fn((_req: TReq, cb: (err: Error | null, res: TRes) => void) => {
    cb(error, undefined as never);
  });
}

describe("GetContactsByIds handler", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ maxEntries: 100 });
  });

  it("should return all contacts from cache without gRPC call", async () => {
    const contact1 = createMockContactDTO("c-1");
    const contact2 = createMockContactDTO("c-2");
    store.set("contact:c-1", contact1);
    store.set("contact:c-2", contact2);

    const mockGeoClient = { getContacts: vi.fn() } as unknown as GeoServiceClient;
    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-1", "c-2"] });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("c-1")).toEqual(contact1);
    expect(result.data?.data.get("c-2")).toEqual(contact2);
    expect(mockGeoClient.getContacts).not.toHaveBeenCalled();
  });

  it("should call gRPC for all IDs on complete cache miss", async () => {
    const contact1 = createMockContactDTO("c-1");
    const contact2 = createMockContactDTO("c-2");

    const mockGeoClient = {
      getContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: { "c-1": contact1, "c-2": contact2 },
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-1", "c-2"] });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("c-1")).toEqual(contact1);
    expect(result.data?.data.get("c-2")).toEqual(contact2);
    expect(mockGeoClient.getContacts).toHaveBeenCalledOnce();
  });

  it("should call gRPC for cache misses only (partial cache)", async () => {
    const cachedContact = createMockContactDTO("c-cached");
    store.set("contact:c-cached", cachedContact);

    const fetchedContact = createMockContactDTO("c-fetched");
    const mockGeoClient = {
      getContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: { "c-fetched": fetchedContact },
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-cached", "c-fetched"] });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(2);
    expect(result.data?.data.get("c-cached")).toEqual(cachedContact);
    expect(result.data?.data.get("c-fetched")).toEqual(fetchedContact);

    // Should only request the missing ID
    const grpcRequest = vi.mocked(mockGeoClient.getContacts).mock.calls[0][0];
    expect(grpcRequest.ids).toEqual(["c-fetched"]);
  });

  it("should return someFound with cached data when gRPC fails and some IDs were cached", async () => {
    const cachedContact = createMockContactDTO("c-cached");
    store.set("contact:c-cached", cachedContact);

    const mockGeoClient = {
      getContacts: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-cached", "c-missing"] });

    // Partial result — cached data returned with SOME_FOUND status
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("SOME_FOUND");
    expect(result.data?.data.size).toBe(1);
    expect(result.data?.data.get("c-cached")).toEqual(cachedContact);
    expect(result.data?.data.has("c-missing")).toBe(false);
  });

  it("should return notFound when gRPC fails and nothing was cached", async () => {
    const mockGeoClient = {
      getContacts: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-1"] });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_FOUND");
    expect(result.data).toBeUndefined();
  });

  it("should return empty Map for empty ids input", async () => {
    const mockGeoClient = { getContacts: vi.fn() } as unknown as GeoServiceClient;
    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: [] });

    expect(result.success).toBe(true);
    expect(result.data?.data.size).toBe(0);
    expect(mockGeoClient.getContacts).not.toHaveBeenCalled();
  });

  it("should populate cache after gRPC fetch", async () => {
    const contact = createMockContactDTO("c-new");
    const mockGeoClient = {
      getContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: { "c-new": contact },
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    await handler.handleAsync({ ids: ["c-new"] });

    // Verify it was cached with the correct key format
    expect(store.get("contact:c-new")).toEqual(contact);
  });

  it("should return notFound when gRPC response indicates failure with no data", async () => {
    const mockGeoClient = {
      getContacts: mockGrpcMethod({
        result: {
          success: false,
          statusCode: 500,
          messages: ["Error"],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: {},
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-1"] });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_FOUND");
  });

  it("should process data from SOME_FOUND gRPC response and return someFound", async () => {
    const contact1 = createMockContactDTO("c-1");
    const mockGeoClient = {
      getContacts: mockGrpcMethod({
        result: {
          success: false,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "SOME_FOUND",
          traceId: "",
        },
        data: { "c-1": contact1 },
      }),
    } as unknown as GeoServiceClient;

    const handler = new GetContactsByIds(store, mockGeoClient, createTestContext());
    const result = await handler.handleAsync({ ids: ["c-1", "c-2"] });

    // Server returned SOME_FOUND with c-1 data — handler processes data and returns someFound
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("SOME_FOUND");
    expect(result.data?.data.size).toBe(1);
    expect(result.data?.data.get("c-1")).toEqual(contact1);
    // c-1 should be cached
    expect(store.get("contact:c-1")).toEqual(contact1);
  });
});
