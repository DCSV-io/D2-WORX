import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { UpdateContactsByExtKeys, DEFAULT_GEO_CLIENT_OPTIONS, type GeoClientOptions } from "@d2/geo-client";

import type { GeoServiceClient, ContactDTO, ContactToCreateDTO } from "@d2/protos";

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

function createMockContactDTO(id: string, contextKey = "org_contact", relatedEntityId = "org-1"): ContactDTO {
  return {
    id,
    createdAt: new Date("2026-02-10"),
    contextKey,
    relatedEntityId,
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

describe("UpdateContactsByExtKeys handler", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ maxEntries: 100 });
  });

  it("should call gRPC updateContactsByExtKeys and return new contacts", async () => {
    const newContact1 = createMockContactDTO("new-1", "org_contact", "org-1");
    const newContact2 = createMockContactDTO("new-2", "org_contact", "org-2");

    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [newContact1, newContact2],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-2",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data).toHaveLength(2);
    expect(result.data?.data[0].id).toBe("new-1");
    expect(result.data?.data[1].id).toBe("new-2");
  });

  it("should pass contacts to gRPC request", async () => {
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [createMockContactDTO("new-1")],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const inputContacts = [
      {
        createdAt: new Date(),
        contextKey: "org_contact",
        relatedEntityId: "org-1",
      } as ContactToCreateDTO,
    ];

    await handler.handleAsync({ contacts: inputContacts });

    expect(mockGeoClient.updateContactsByExtKeys).toHaveBeenCalledOnce();
    const grpcRequest = vi.mocked(mockGeoClient.updateContactsByExtKeys).mock.calls[0][0];
    expect(grpcRequest.contacts).toEqual(inputContacts);
  });

  it("should evict ext-key cache for each input contact", async () => {
    // Pre-populate cache
    store.set("contact-ext:org_contact:org-1", [{ id: "old-1" } as ContactDTO]);
    store.set("contact-ext:org_contact:org-2", [{ id: "old-2" } as ContactDTO]);
    store.set("contact-ext:org_contact:org-3", [{ id: "old-3" } as ContactDTO]);

    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [
          createMockContactDTO("new-1", "org_contact", "org-1"),
          createMockContactDTO("new-2", "org_contact", "org-2"),
        ],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-2",
        } as ContactToCreateDTO,
      ],
    });

    // org-1 and org-2 evicted, org-3 remains
    expect(store.get("contact-ext:org_contact:org-1")).toBeUndefined();
    expect(store.get("contact-ext:org_contact:org-2")).toBeUndefined();
    expect(store.get("contact-ext:org_contact:org-3")).toBeDefined();
  });

  it("should evict cache even on gRPC failure", async () => {
    store.set("contact-ext:org_contact:org-1", [{ id: "old-1" } as ContactDTO]);

    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    // Cache should still be evicted even though gRPC failed
    expect(store.get("contact-ext:org_contact:org-1")).toBeUndefined();
  });

  it("should return failure on gRPC error", async () => {
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(false);
  });

  it("should return validation error when context key is not in allowedContextKeys", async () => {
    const mockGeoClient = {
      updateContactsByExtKeys: vi.fn(),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["org_contact"],
    };

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      restrictedOptions,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "not_allowed",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.inputErrors).toBeDefined();
    expect(result.inputErrors!.length).toBeGreaterThan(0);
    expect(mockGeoClient.updateContactsByExtKeys).not.toHaveBeenCalled();
  });

  it("should return failure when gRPC result indicates failure", async () => {
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: false,
          statusCode: 400,
          messages: ["Validation error"],
          inputErrors: [],
          errorCode: "VALIDATION_FAILED",
          traceId: "",
        },
        data: [],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(false);
  });

  it("should allow request when context key is in allowedContextKeys", async () => {
    const newContact = createMockContactDTO("new-1", "org_contact", "org-1");
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [newContact],
      }),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["org_contact"],
    };

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      restrictedOptions,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.updateContactsByExtKeys).toHaveBeenCalledOnce();
  });

  it("should skip allowedContextKeys validation when list is empty", async () => {
    const newContact = createMockContactDTO("new-1", "any_key", "org-1");
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [newContact],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "any_key",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.updateContactsByExtKeys).toHaveBeenCalledOnce();
  });

  it("should not repopulate cache with new contacts after eviction", async () => {
    store.set("contact-ext:org_contact:org-1", [{ id: "old-1" } as ContactDTO]);

    const newContact = createMockContactDTO("new-1", "org_contact", "org-1");
    const mockGeoClient = {
      updateContactsByExtKeys: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [newContact],
      }),
    } as unknown as GeoServiceClient;

    const handler = new UpdateContactsByExtKeys(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "org_contact",
          relatedEntityId: "org-1",
        } as ContactToCreateDTO,
      ],
    });

    // Cache was evicted and NOT repopulated — next GetContactsByExtKeys will cache it
    expect(store.get("contact-ext:org_contact:org-1")).toBeUndefined();
  });
});
