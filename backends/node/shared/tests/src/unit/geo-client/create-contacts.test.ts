import { describe, it, expect, vi } from "vitest";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { CreateContacts, DEFAULT_GEO_CLIENT_OPTIONS, type GeoClientOptions } from "@d2/geo-client";

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
    contextKey: "auth_org_contact",
    relatedEntityId: "related-1",
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

describe("CreateContacts handler", () => {
  it("should call gRPC createContacts and return created contacts", async () => {
    const contact1 = createMockContactDTO("contact-1");
    const contact2 = createMockContactDTO("contact-2");

    const mockGeoClient = {
      createContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [contact1, contact2],
      }),
    } as unknown as GeoServiceClient;

    const handler = new CreateContacts(
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "auth_org_contact",
          relatedEntityId: "oc-1",
        } as never,
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.data).toHaveLength(2);
    expect(result.data?.data[0].id).toBe("contact-1");
    expect(result.data?.data[1].id).toBe("contact-2");
  });

  it("should pass contactsToCreate to gRPC request", async () => {
    const mockGeoClient = {
      createContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [createMockContactDTO("c-1")],
      }),
    } as unknown as GeoServiceClient;

    const handler = new CreateContacts(
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const inputContacts = [
      {
        createdAt: new Date(),
        contextKey: "auth_org_contact",
        relatedEntityId: "oc-1",
      } as never,
    ];

    await handler.handleAsync({ contacts: inputContacts });

    expect(mockGeoClient.createContacts).toHaveBeenCalledOnce();
    const grpcRequest = vi.mocked(mockGeoClient.createContacts).mock.calls[0][0];
    expect(grpcRequest.contactsToCreate).toEqual(inputContacts);
  });

  it("should return failure on gRPC error", async () => {
    const mockGeoClient = {
      createContacts: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new CreateContacts(
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [{ createdAt: new Date(), contextKey: "test", relatedEntityId: "x" } as never],
    });

    expect(result.success).toBe(false);
  });

  it("should return failure when gRPC result indicates failure", async () => {
    const mockGeoClient = {
      createContacts: mockGrpcMethod({
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

    const handler = new CreateContacts(
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [{ createdAt: new Date(), contextKey: "test", relatedEntityId: "x" } as never],
    });

    expect(result.success).toBe(false);
  });

  it("should return validation error when context key is not in allowedContextKeys", async () => {
    const mockGeoClient = {
      createContacts: vi.fn(),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["auth_org_contact"],
    };

    const handler = new CreateContacts(mockGeoClient, restrictedOptions, createTestContext());
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "not_allowed",
          relatedEntityId: "x",
        } as never,
      ],
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.inputErrors).toBeDefined();
    expect(result.inputErrors!.length).toBeGreaterThan(0);
    expect(mockGeoClient.createContacts).not.toHaveBeenCalled();
  });

  it("should allow request when context key is in allowedContextKeys", async () => {
    const contact = createMockContactDTO("c-1");
    const mockGeoClient = {
      createContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [contact],
      }),
    } as unknown as GeoServiceClient;

    const restrictedOptions: GeoClientOptions = {
      ...DEFAULT_GEO_CLIENT_OPTIONS,
      allowedContextKeys: ["auth_org_contact"],
    };

    const handler = new CreateContacts(mockGeoClient, restrictedOptions, createTestContext());
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "auth_org_contact",
          relatedEntityId: "x",
        } as never,
      ],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.createContacts).toHaveBeenCalledOnce();
  });

  it("should skip validation when allowedContextKeys is empty", async () => {
    const contact = createMockContactDTO("c-1");
    const mockGeoClient = {
      createContacts: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [contact],
      }),
    } as unknown as GeoServiceClient;

    const handler = new CreateContacts(
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      contacts: [
        {
          createdAt: new Date(),
          contextKey: "any_key",
          relatedEntityId: "x",
        } as never,
      ],
    });

    expect(result.success).toBe(true);
    expect(mockGeoClient.createContacts).toHaveBeenCalledOnce();
  });
});
