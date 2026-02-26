import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichRequest } from "@d2/request-enrichment";
import { D2Result } from "@d2/result";
import type { FindWhoIs, FindWhoIsOutput } from "@d2/geo-client";
import type { ILogger } from "@d2/logging";
import type { WhoIsDTO, LocationDTO } from "@d2/protos";

function createMockFindWhoIs(result?: D2Result<FindWhoIsOutput | undefined>): FindWhoIs {
  return {
    handleAsync: vi
      .fn()
      .mockResolvedValue(
        result ?? D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs: undefined } }),
      ),
  } as unknown as FindWhoIs;
}

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
}

function createWhoIsDTO(overrides?: Partial<WhoIsDTO>): WhoIsDTO {
  const location: LocationDTO = {
    hashId: "loc-hash",
    coordinates: undefined,
    address: undefined,
    city: "Los Angeles",
    postalCode: "90001",
    subdivisionIso31662Code: "US-CA",
    countryIso31661Alpha2Code: "US",
    ...(overrides?.location ?? {}),
  };

  return {
    hashId: "whois-hash-id",
    ipAddress: "1.2.3.4",
    year: 2025,
    month: 6,
    fingerprint: "Mozilla/5.0",
    asn: 15169,
    asName: "GOOGLE",
    asDomain: "google.com",
    asType: "Content",
    carrierName: "",
    mcc: "",
    mnc: "",
    asChanged: "2025-01-01",
    geoChanged: "2025-01-01",
    isAnonymous: false,
    isAnycast: false,
    isHosting: false,
    isMobile: false,
    isSatellite: false,
    isProxy: false,
    isRelay: false,
    isTor: false,
    isVpn: false,
    privacyName: "",
    location,
    ...overrides,
  };
}

describe("enrichRequest", () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should set clientIp from headers", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({ "cf-connecting-ip": "10.0.0.1" }, handler, {
      enableWhoIsLookup: false,
    });
    expect(info.clientIp).toBe("10.0.0.1");
  });

  it("should set serverFingerprint as 64-char hex", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({ "user-agent": "TestAgent/1.0" }, handler, {
      enableWhoIsLookup: false,
    });
    expect(info.serverFingerprint).toHaveLength(64);
    expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should read clientFingerprint from configured header", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({ "x-client-fingerprint": "my-fp-123" }, handler, {
      enableWhoIsLookup: false,
    });
    expect(info.clientFingerprint).toBe("my-fp-123");
  });

  it("should set clientFingerprint to undefined when header missing", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.clientFingerprint).toBeUndefined();
  });

  it("should populate geo fields from WhoIs data", async () => {
    const whoIs = createWhoIsDTO({
      isVpn: true,
      isProxy: false,
      isTor: true,
      isHosting: false,
    });
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs } }),
    );

    const info = await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4", "user-agent": "Mozilla/5.0" },
      handler,
      undefined,
      mockLogger,
    );

    expect(info.whoIsHashId).toBe("whois-hash-id");
    expect(info.city).toBe("Los Angeles");
    expect(info.countryCode).toBe("US");
    expect(info.subdivisionCode).toBe("US-CA");
    expect(info.isVpn).toBe(true);
    expect(info.isProxy).toBe(false);
    expect(info.isTor).toBe(true);
    expect(info.isHosting).toBe(false);
  });

  it("should fail-open when WhoIs handler returns failure result", async () => {
    const handler = createMockFindWhoIs(
      D2Result.fail<FindWhoIsOutput | undefined>({ messages: ["service down"] }),
    );

    const info = await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4" },
      handler,
      undefined,
      mockLogger,
    );

    expect(info.clientIp).toBe("1.2.3.4");
    expect(info.city).toBeUndefined();
    expect(info.countryCode).toBeUndefined();
  });

  it("should fail-open when WhoIs handler throws an exception", async () => {
    const handler = {
      handleAsync: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as FindWhoIs;

    const info = await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4" },
      handler,
      undefined,
      mockLogger,
    );

    expect(info.clientIp).toBe("1.2.3.4");
    expect(info.city).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("should set geo fields to undefined when WhoIs returns no data", async () => {
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs: undefined } }),
    );

    const info = await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4" },
      handler,
      undefined,
      mockLogger,
    );

    expect(info.whoIsHashId).toBeUndefined();
    expect(info.city).toBeUndefined();
    expect(info.countryCode).toBeUndefined();
  });

  it("should skip WhoIs lookup for localhost IP", async () => {
    const handler = createMockFindWhoIs();

    const info = await enrichRequest({}, handler);

    // No headers → IP resolves to "unknown" which is localhost
    expect(info.clientIp).toBe("unknown");
    expect(handler.handleAsync).not.toHaveBeenCalled();
  });

  it("should skip WhoIs lookup when enableWhoIsLookup is false", async () => {
    const handler = createMockFindWhoIs();

    const info = await enrichRequest({ "cf-connecting-ip": "1.2.3.4" }, handler, {
      enableWhoIsLookup: false,
    });

    expect(info.clientIp).toBe("1.2.3.4");
    expect(handler.handleAsync).not.toHaveBeenCalled();
  });

  it("should default isAuthenticated to false", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.isAuthenticated).toBe(false);
  });

  it("should default userId to undefined", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.userId).toBeUndefined();
  });

  it("should handle array-valued client fingerprint header", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest(
      { "x-client-fingerprint": ["fp-from-array", "fp-second"] },
      handler,
      { enableWhoIsLookup: false },
    );
    expect(info.clientFingerprint).toBe("fp-from-array");
  });

  it("should use empty string fingerprint when user-agent header is missing", async () => {
    const whoIs = createWhoIsDTO();
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs } }),
    );

    await enrichRequest({ "cf-connecting-ip": "1.2.3.4" }, handler, undefined, mockLogger);

    // user-agent is undefined → fingerprint should be ""
    expect(handler.handleAsync).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "" }));
  });

  it("should use empty string fingerprint when user-agent is empty array", async () => {
    const whoIs = createWhoIsDTO();
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs } }),
    );

    await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4", "user-agent": [] },
      handler,
      undefined,
      mockLogger,
    );

    // user-agent is [] → userAgent[0] is undefined → fingerprint should be ""
    expect(handler.handleAsync).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "" }));
  });

  it("should convert empty WhoIs fields to undefined", async () => {
    const whoIs = createWhoIsDTO({
      hashId: "",
      location: {
        hashId: "",
        coordinates: undefined,
        address: undefined,
        city: "",
        postalCode: "",
        subdivisionIso31662Code: "",
        countryIso31661Alpha2Code: "",
      },
    });
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs } }),
    );

    const info = await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4", "user-agent": "Mozilla/5.0" },
      handler,
      undefined,
      mockLogger,
    );

    // Empty strings should be converted to undefined via || undefined
    expect(info.whoIsHashId).toBeUndefined();
    expect(info.city).toBeUndefined();
    expect(info.countryCode).toBeUndefined();
    expect(info.subdivisionCode).toBeUndefined();
  });

  it("should handle array-valued user-agent header for WhoIs fingerprint", async () => {
    const whoIs = createWhoIsDTO();
    const handler = createMockFindWhoIs(
      D2Result.ok<FindWhoIsOutput | undefined>({ data: { whoIs } }),
    );

    await enrichRequest(
      { "cf-connecting-ip": "1.2.3.4", "user-agent": ["Agent/1.0", "Agent/2.0"] },
      handler,
      undefined,
      mockLogger,
    );

    // Verify FindWhoIs was called with first array element as fingerprint
    expect(handler.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: "Agent/1.0" }),
    );
  });
});
