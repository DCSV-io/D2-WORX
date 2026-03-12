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

  it("should read clientFingerprint from d2-cfp cookie (primary source)", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({ cookie: "d2-cfp=cookie-fp-456; other=val" }, handler, {
      enableWhoIsLookup: false,
    });
    expect(info.clientFingerprint).toBe("cookie-fp-456");
  });

  it("should prefer cookie over header for clientFingerprint", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest(
      {
        cookie: "d2-cfp=from-cookie",
        "x-client-fingerprint": "from-header",
      },
      handler,
      { enableWhoIsLookup: false },
    );
    expect(info.clientFingerprint).toBe("from-cookie");
  });

  it("should fall back to header when d2-cfp cookie is missing", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest(
      {
        cookie: "other=val",
        "x-client-fingerprint": "from-header",
      },
      handler,
      { enableWhoIsLookup: false },
    );
    expect(info.clientFingerprint).toBe("from-header");
  });

  it("should set clientFingerprint to undefined when header missing", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.clientFingerprint).toBeUndefined();
  });

  it("should always set deviceFingerprint as 64-char hex", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.deviceFingerprint).toHaveLength(64);
    expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should set deviceFingerprint even when clientFingerprint is missing", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.clientFingerprint).toBeUndefined();
    // deviceFingerprint is always present (SHA-256 of "" + serverFP + clientIp)
    expect(info.deviceFingerprint).toHaveLength(64);
    expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce different deviceFingerprints for different clientFingerprints", async () => {
    const handler = createMockFindWhoIs();
    const info1 = await enrichRequest({ "x-client-fingerprint": "fp-aaa" }, handler, {
      enableWhoIsLookup: false,
    });
    const info2 = await enrichRequest({ "x-client-fingerprint": "fp-bbb" }, handler, {
      enableWhoIsLookup: false,
    });
    expect(info1.deviceFingerprint).not.toBe(info2.deviceFingerprint);
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

  it("should default auth flags to null (unknown pre-auth)", async () => {
    const handler = createMockFindWhoIs();
    const info = await enrichRequest({}, handler, { enableWhoIsLookup: false });
    expect(info.isAuthenticated).toBeNull();
    expect(info.isTrustedService).toBeNull();
    expect(info.isOrgEmulating).toBeNull();
    expect(info.isUserImpersonating).toBeNull();
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
    // deviceFingerprint should also be computed using the first array value
    expect(info.deviceFingerprint).toHaveLength(64);
    expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
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

  describe("adversarial inputs", () => {
    it("should compute fingerprints even when all headers are empty strings", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest(
        {
          "user-agent": "",
          "accept-language": "",
          "accept-encoding": "",
          accept: "",
          "cf-connecting-ip": "",
          "x-client-fingerprint": "",
        },
        handler,
        { enableWhoIsLookup: false },
      );

      // Empty strings → empty input to SHA-256, but hash is still computed
      expect(info.serverFingerprint).toHaveLength(64);
      expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(info.deviceFingerprint).toHaveLength(64);
      expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
      // Empty string fingerprint header is treated as no fingerprint
      expect(info.clientFingerprint).toBeUndefined();
    });

    it("should truncate client fingerprint exceeding maxFingerprintLength", async () => {
      const handler = createMockFindWhoIs();
      const longFp = "X".repeat(1000);
      const info = await enrichRequest({ "x-client-fingerprint": longFp }, handler, {
        enableWhoIsLookup: false,
        maxFingerprintLength: 256,
      });

      expect(info.clientFingerprint).toHaveLength(256);
      expect(info.clientFingerprint).toBe("X".repeat(256));
    });

    it("should truncate client fingerprint to custom maxFingerprintLength", async () => {
      const handler = createMockFindWhoIs();
      const longFp = "Z".repeat(500);
      const info = await enrichRequest({ "x-client-fingerprint": longFp }, handler, {
        enableWhoIsLookup: false,
        maxFingerprintLength: 50,
      });

      expect(info.clientFingerprint).toHaveLength(50);
      expect(info.clientFingerprint).toBe("Z".repeat(50));
    });

    it("should not crash with null bytes in header values", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest(
        {
          "user-agent": "\x00\x00",
          "cf-connecting-ip": "1.2.3.4",
        },
        handler,
        { enableWhoIsLookup: false },
      );

      // Null bytes don't crash SHA-256 — fingerprint is still computed
      expect(info.serverFingerprint).toHaveLength(64);
      expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(info.deviceFingerprint).toHaveLength(64);
      expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(info.clientIp).toBe("1.2.3.4");
    });

    it("should handle unicode (emoji) in user-agent and produce valid fingerprint", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest(
        { "user-agent": "TestBot/1.0 \u{1F600}\u{1F4A9}", "cf-connecting-ip": "1.2.3.4" },
        handler,
        { enableWhoIsLookup: false },
      );

      expect(info.serverFingerprint).toHaveLength(64);
      expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should handle CJK characters in user-agent and produce valid fingerprint", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest(
        { "user-agent": "\u65E5\u672C\u8A9E\u30D6\u30E9\u30A6\u30B6/2.0" },
        handler,
        { enableWhoIsLookup: false },
      );

      expect(info.serverFingerprint).toHaveLength(64);
      expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should produce different server fingerprints for different unicode user-agents", async () => {
      const handler = createMockFindWhoIs();
      const info1 = await enrichRequest({ "user-agent": "\u{1F600}" }, handler, {
        enableWhoIsLookup: false,
      });
      const info2 = await enrichRequest({ "user-agent": "\u{1F4A9}" }, handler, {
        enableWhoIsLookup: false,
      });

      expect(info1.serverFingerprint).not.toBe(info2.serverFingerprint);
    });

    it("should handle client fingerprint with unicode characters", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest(
        { "x-client-fingerprint": "\u4E2D\u6587\u6307\u7EB9" },
        handler,
        { enableWhoIsLookup: false },
      );

      expect(info.clientFingerprint).toBe("\u4E2D\u6587\u6307\u7EB9");
      expect(info.deviceFingerprint).toHaveLength(64);
      expect(info.deviceFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should handle cookie header with null bytes without crashing", async () => {
      const handler = createMockFindWhoIs();
      const info = await enrichRequest({ cookie: "d2-cfp=\x00abc\x00; other=val" }, handler, {
        enableWhoIsLookup: false,
      });

      // Cookie parsing should still extract the value (null bytes are part of the value)
      expect(info.clientFingerprint).toBe("\x00abc\x00");
    });

    it("should not crash when client fingerprint is exactly at maxFingerprintLength", async () => {
      const handler = createMockFindWhoIs();
      const exactLengthFp = "A".repeat(256);
      const info = await enrichRequest({ "x-client-fingerprint": exactLengthFp }, handler, {
        enableWhoIsLookup: false,
        maxFingerprintLength: 256,
      });

      // Exactly at limit — should NOT be truncated
      expect(info.clientFingerprint).toHaveLength(256);
      expect(info.clientFingerprint).toBe(exactLengthFp);
    });

    it("should truncate client fingerprint one char over maxFingerprintLength", async () => {
      const handler = createMockFindWhoIs();
      const overLimitFp = "A".repeat(257);
      const info = await enrichRequest({ "x-client-fingerprint": overLimitFp }, handler, {
        enableWhoIsLookup: false,
        maxFingerprintLength: 256,
      });

      expect(info.clientFingerprint).toHaveLength(256);
    });

    it("should produce consistent deviceFingerprint for same inputs", async () => {
      const handler = createMockFindWhoIs();
      const headers = {
        "cf-connecting-ip": "10.0.0.1",
        "user-agent": "Bot/1.0",
        "x-client-fingerprint": "fp-stable",
      };
      const info1 = await enrichRequest(headers, handler, { enableWhoIsLookup: false });
      const info2 = await enrichRequest(headers, handler, { enableWhoIsLookup: false });

      expect(info1.deviceFingerprint).toBe(info2.deviceFingerprint);
      expect(info1.serverFingerprint).toBe(info2.serverFingerprint);
    });

    it("should handle very long user-agent without crashing", async () => {
      const handler = createMockFindWhoIs();
      const longUa = "Mozilla/5.0 ".repeat(5000); // ~60,000 chars
      const info = await enrichRequest(
        { "user-agent": longUa, "cf-connecting-ip": "1.2.3.4" },
        handler,
        { enableWhoIsLookup: false },
      );

      // SHA-256 handles arbitrary length input — fingerprint is still 64-char hex
      expect(info.serverFingerprint).toHaveLength(64);
      expect(info.serverFingerprint).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
