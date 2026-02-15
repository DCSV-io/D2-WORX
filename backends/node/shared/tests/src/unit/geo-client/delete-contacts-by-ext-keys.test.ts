import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { DeleteContactsByExtKeys, DEFAULT_GEO_CLIENT_OPTIONS, type GeoClientOptions } from "@d2/geo-client";

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

describe("DeleteContactsByExtKeys handler", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ maxEntries: 100 });
  });

  it("should call gRPC deleteContactsByExtKeys and return deleted count", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        deleted: 3,
      }),
    } as unknown as GeoServiceClient;

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [
        { contextKey: "org_contact", relatedEntityId: "org-1" },
        { contextKey: "org_contact", relatedEntityId: "org-2" },
        { contextKey: "org_contact", relatedEntityId: "org-3" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.deleted).toBe(3);
  });

  it("should pass keys to gRPC request", async () => {
    const mockGeoClient = {
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

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const inputKeys = [
      { contextKey: "org_contact", relatedEntityId: "org-1" },
      { contextKey: "org_contact", relatedEntityId: "org-2" },
    ];
    await handler.handleAsync({ keys: inputKeys });

    expect(mockGeoClient.deleteContactsByExtKeys).toHaveBeenCalledOnce();
    const grpcRequest = vi.mocked(mockGeoClient.deleteContactsByExtKeys).mock.calls[0][0];
    expect(grpcRequest.keys).toEqual(inputKeys);
  });

  it("should evict ext-key cache for each input key", async () => {
    // Pre-populate cache
    store.set("contact-ext:org_contact:org-1", [{ id: "c-1" } as ContactDTO]);
    store.set("contact-ext:org_contact:org-2", [{ id: "c-2" } as ContactDTO]);
    store.set("contact-ext:org_contact:org-3", [{ id: "c-3" } as ContactDTO]);

    const mockGeoClient = {
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

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      keys: [
        { contextKey: "org_contact", relatedEntityId: "org-1" },
        { contextKey: "org_contact", relatedEntityId: "org-2" },
      ],
    });

    // org-1 and org-2 evicted, org-3 remains
    expect(store.get("contact-ext:org_contact:org-1")).toBeUndefined();
    expect(store.get("contact-ext:org_contact:org-2")).toBeUndefined();
    expect(store.get("contact-ext:org_contact:org-3")).toBeDefined();
  });

  it("should evict cache even on gRPC failure", async () => {
    store.set("contact-ext:org_contact:org-1", [{ id: "c-1" } as ContactDTO]);

    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      keys: [{ contextKey: "org_contact", relatedEntityId: "org-1" }],
    });

    // Cache should still be evicted even though gRPC failed
    expect(store.get("contact-ext:org_contact:org-1")).toBeUndefined();
  });

  it("should return failure on gRPC error", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "org_contact", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(false);
  });

  it("should return validation error when context key is not in allowedContextKeys", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: vi.fn(),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["org_contact"],
    };

    const handler = new DeleteContactsByExtKeys(
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
    expect(mockGeoClient.deleteContactsByExtKeys).not.toHaveBeenCalled();
  });

  it("should allow request when context key is in allowedContextKeys", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        deleted: 1,
      }),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["org_contact"],
    };

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      restrictedOptions,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "org_contact", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.deleteContactsByExtKeys).toHaveBeenCalledOnce();
  });

  it("should skip allowedContextKeys validation when list is empty", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        deleted: 1,
      }),
    } as unknown as GeoServiceClient;

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "any_key", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.deleteContactsByExtKeys).toHaveBeenCalledOnce();
  });

  it("should return failure when gRPC result indicates failure", async () => {
    const mockGeoClient = {
      deleteContactsByExtKeys: mockGrpcMethod({
        result: {
          success: false,
          statusCode: 400,
          messages: ["Validation error"],
          inputErrors: [],
          errorCode: "VALIDATION_FAILED",
          traceId: "",
        },
        deleted: 0,
      }),
    } as unknown as GeoServiceClient;

    const handler = new DeleteContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      keys: [{ contextKey: "org_contact", relatedEntityId: "org-1" }],
    });

    expect(result.success).toBe(false);
  });
});
