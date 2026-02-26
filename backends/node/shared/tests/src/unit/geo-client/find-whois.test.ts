import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { FindWhoIs, DEFAULT_GEO_CLIENT_OPTIONS, GEO_CACHE_KEYS } from "@d2/geo-client";
import { ErrorCodes } from "@d2/result";
import type { GeoServiceClient, WhoIsDTO } from "@d2/protos";

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

function createMockWhoIs(): WhoIsDTO {
  return {
    ipAddress: "1.2.3.4",
    city: "Test City",
    countryIso31661Alpha2Code: "US",
    subdivisionIso31662Code: "US-CA",
    isVpn: false,
    isTor: false,
    isProxy: false,
    isDatacenter: false,
    isCrawler: false,
    threat: "",
    asn: "",
    asnOrganization: "",
    coordinates: undefined,
  } as WhoIsDTO;
}

/**
 * Creates a mock callback-based gRPC method that invokes the callback
 * with the given response (or error).
 */
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

describe("FindWhoIs handler", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ maxEntries: 100 });
  });

  it("should return cached WhoIs data without making gRPC call", async () => {
    const whoIs = createMockWhoIs();
    store.set(GEO_CACHE_KEYS.whois("1.2.3.4", "ua-fingerprint"), whoIs);

    const mockGeoClient = { findWhoIs: vi.fn() } as unknown as GeoServiceClient;
    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      ipAddress: "1.2.3.4",
      fingerprint: "ua-fingerprint",
    });

    expect(result).toBeSuccess();
    expect(result.data?.whoIs).toEqual(whoIs);
    expect(mockGeoClient.findWhoIs).not.toHaveBeenCalled();
  });

  it("should call gRPC on cache miss and return WhoIs data", async () => {
    const whoIs = createMockWhoIs();
    const mockGeoClient = {
      findWhoIs: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [{ key: { ipAddress: "1.2.3.4", fingerprint: "fp" }, whois: whoIs }],
      }),
    } as unknown as GeoServiceClient;

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({ ipAddress: "1.2.3.4", fingerprint: "fp" });

    expect(result).toBeSuccess();
    expect(result.data?.whoIs).toEqual(whoIs);
    expect(mockGeoClient.findWhoIs).toHaveBeenCalled();
  });

  it("should cache gRPC result for future lookups", async () => {
    const whoIs = createMockWhoIs();
    const mockGeoClient = {
      findWhoIs: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [{ key: { ipAddress: "1.2.3.4", fingerprint: "fp" }, whois: whoIs }],
      }),
    } as unknown as GeoServiceClient;

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({ ipAddress: "1.2.3.4", fingerprint: "fp" });

    expect(store.get(GEO_CACHE_KEYS.whois("1.2.3.4", "fp"))).toEqual(whoIs);
  });

  it("should return Ok(undefined) on gRPC failure (fail-open)", async () => {
    const mockGeoClient = {
      findWhoIs: mockGrpcMethodError(new Error("Connection refused")),
    } as unknown as GeoServiceClient;

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({ ipAddress: "1.2.3.4", fingerprint: "fp" });

    expect(result).toBeSuccess();
    expect(result.data?.whoIs).toBeUndefined();
  });

  it("should return Ok(undefined) when gRPC returns empty data", async () => {
    const mockGeoClient = {
      findWhoIs: mockGrpcMethod({
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

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({ ipAddress: "1.2.3.4", fingerprint: "fp" });

    expect(result).toBeSuccess();
    expect(result.data?.whoIs).toBeUndefined();
  });

  it("should return Ok(undefined) when gRPC result indicates failure", async () => {
    const mockGeoClient = {
      findWhoIs: mockGrpcMethod({
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

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({ ipAddress: "1.2.3.4", fingerprint: "fp" });

    expect(result).toBeSuccess();
    expect(result.data?.whoIs).toBeUndefined();
  });

  it("should use correct cache key format geo:whois:{ip}:{fingerprint}", async () => {
    const whoIs = createMockWhoIs();
    const mockGeoClient = {
      findWhoIs: mockGrpcMethod({
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: [{ key: { ipAddress: "10.0.0.1", fingerprint: "abc123" }, whois: whoIs }],
      }),
    } as unknown as GeoServiceClient;

    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    await handler.handleAsync({ ipAddress: "10.0.0.1", fingerprint: "abc123" });

    expect(store.get("geo:whois:10.0.0.1:abc123")).toEqual(whoIs);
    expect(store.get("geo:whois:10.0.0.1:other")).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Input validation tests
  // -------------------------------------------------------------------------

  it("should return validationFailed for invalid IP address", async () => {
    const mockGeoClient = { findWhoIs: vi.fn() } as unknown as GeoServiceClient;
    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      ipAddress: "not-an-ip",
      fingerprint: "ua-fingerprint",
    });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(mockGeoClient.findWhoIs).not.toHaveBeenCalled();
  });

  it("should return validationFailed for empty fingerprint", async () => {
    const mockGeoClient = { findWhoIs: vi.fn() } as unknown as GeoServiceClient;
    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      ipAddress: "1.2.3.4",
      fingerprint: "",
    });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(mockGeoClient.findWhoIs).not.toHaveBeenCalled();
  });

  it("should return validationFailed for empty IP address", async () => {
    const mockGeoClient = { findWhoIs: vi.fn() } as unknown as GeoServiceClient;
    const handler = new FindWhoIs(
      store,
      mockGeoClient,
      DEFAULT_GEO_CLIENT_OPTIONS,
      createTestContext(),
    );
    const result = await handler.handleAsync({
      ipAddress: "",
      fingerprint: "ua-fingerprint",
    });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
