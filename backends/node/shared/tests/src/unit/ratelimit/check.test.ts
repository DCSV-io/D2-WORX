import { describe, it, expect, vi, beforeEach } from "vitest";
import { Check, RateLimitDimension, type CheckInput } from "@d2/ratelimit";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";
import type { IRequestInfo } from "@d2/request-enrichment";

function createTestContext(traceId?: string): IHandlerContext {
  const request: IRequestContext = {
    traceId: traceId ?? "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createRequestInfo(overrides?: Partial<IRequestInfo>): IRequestInfo {
  return {
    clientIp: "1.2.3.4",
    serverFingerprint: "a".repeat(64),
    clientFingerprint: "client-fp-123",
    whoIsHashId: "whois-hash",
    city: "Los Angeles",
    countryCode: "FR",
    subdivisionCode: "FR-IDF",
    isVpn: false,
    isProxy: false,
    isTor: false,
    isHosting: false,
    userId: undefined,
    isAuthenticated: false,
    ...overrides,
  };
}

interface MockHandlers {
  getTtl: DistributedCache.IGetTtlHandler;
  increment: DistributedCache.IIncrementHandler;
  set: DistributedCache.ISetHandler<string>;
  getTtlFn: ReturnType<typeof vi.fn>;
  incrementFn: ReturnType<typeof vi.fn>;
  setFn: ReturnType<typeof vi.fn>;
}

function createMockHandlers(): MockHandlers {
  const getTtlFn = vi.fn().mockResolvedValue(
    D2Result.ok<DistributedCache.GetTtlOutput | undefined>({
      data: { timeToLiveMs: undefined },
    }),
  );
  const incrementFn = vi.fn().mockResolvedValue(
    D2Result.ok<DistributedCache.IncrementOutput | undefined>({
      data: { newValue: 1 },
    }),
  );
  const setFn = vi
    .fn()
    .mockResolvedValue(D2Result.ok<DistributedCache.SetOutput | undefined>({ data: {} }));

  return {
    getTtl: { handleAsync: getTtlFn } as unknown as DistributedCache.IGetTtlHandler,
    increment: { handleAsync: incrementFn } as unknown as DistributedCache.IIncrementHandler,
    set: { handleAsync: setFn } as unknown as DistributedCache.ISetHandler<string>,
    getTtlFn,
    incrementFn,
    setFn,
  };
}

function createCheck(mocks: MockHandlers, options?: Record<string, unknown>): Check {
  return new Check(mocks.getTtl, mocks.increment, mocks.set, options ?? {}, createTestContext());
}

describe("RateLimit Check handler", () => {
  let mocks: MockHandlers;

  beforeEach(() => {
    mocks = createMockHandlers();
  });

  // -----------------------------------------------------------------------
  // Basic flow
  // -----------------------------------------------------------------------

  it("should return not blocked when all counts are below thresholds", async () => {
    const handler = createCheck(mocks);
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
    expect(result.data?.blockedDimension).toBeUndefined();
    expect(result.data?.retryAfterMs).toBeUndefined();
  });

  it("should return blocked when fingerprint count exceeds threshold", async () => {
    // GetTtl returns no block key, Increment returns high count
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, { clientFingerprintThreshold: 50 });
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.ClientFingerprint);
  });

  it("should return blocked when IP count exceeds threshold", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 1000,
      ipThreshold: 50,
    });
    const info = createRequestInfo({ clientFingerprint: undefined });
    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.Ip);
  });

  it("should return blocked when city count exceeds threshold", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 1000,
      ipThreshold: 1000,
      cityThreshold: 50,
    });
    const info = createRequestInfo({ clientFingerprint: undefined });
    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.City);
  });

  it("should return blocked when country count exceeds threshold", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 1000,
      ipThreshold: 1000,
      cityThreshold: 1000,
      countryThreshold: 50,
    });
    const info = createRequestInfo({ clientFingerprint: undefined, city: undefined });
    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.Country);
  });

  // -----------------------------------------------------------------------
  // Sliding window
  // -----------------------------------------------------------------------

  it("should correctly calculate weighted estimate from two windows", async () => {
    // Prev window: 40 requests, current window: 10 requests
    // At roughly 30s into window (weight ~0.5): estimated = 40*0.5 + 10 = 30
    let callCount = 0;
    mocks.incrementFn.mockImplementation(async () => {
      callCount++;
      // First call is prev window (amount: 0), second is current window (amount: 1)
      if (callCount % 2 === 1) {
        return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
          data: { newValue: 40 },
        });
      }
      return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 10 },
      });
    });

    const handler = createCheck(mocks, { clientFingerprintThreshold: 100 });
    const info = createRequestInfo({ clientFingerprint: "fp" });
    const result = await handler.handleAsync({ requestInfo: info });

    // With low counts, should not be blocked
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should set counter TTL to 2x window size", async () => {
    const handler = createCheck(mocks, { windowMs: 30_000 });
    await handler.handleAsync({ requestInfo: createRequestInfo() });

    // Increment calls should use expirationMs = 2 * 30_000 = 60_000
    const incrementCalls = mocks.incrementFn.mock.calls;
    for (const call of incrementCalls) {
      expect(call[0].expirationMs).toBe(60_000);
    }
  });

  it("should set block key with blockDurationMs TTL", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 50,
      blockDurationMs: 120_000,
    });
    await handler.handleAsync({ requestInfo: createRequestInfo() });

    // Set should have been called with blockDuration TTL
    expect(mocks.setFn).toHaveBeenCalled();
    const setCall = mocks.setFn.mock.calls[0][0];
    expect(setCall.expirationMs).toBe(120_000);
    expect(setCall.value).toBe("1");
    expect(setCall.key).toContain("blocked:");
  });

  // -----------------------------------------------------------------------
  // Dimension skipping
  // -----------------------------------------------------------------------

  it("should skip fingerprint check when clientFingerprint is undefined", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 1,
      ipThreshold: 1000,
      cityThreshold: 1000,
      countryThreshold: 1000,
    });
    const info = createRequestInfo({ clientFingerprint: undefined });
    const result = await handler.handleAsync({ requestInfo: info });

    // Should be blocked on IP (threshold 1000 < 200 doesn't block),
    // but not on fingerprint (skipped)
    expect(result).toBeSuccess();
    // Verify no blocked key contains "clientfingerprint"
    const getTtlCalls = mocks.getTtlFn.mock.calls;
    const fpCalls = getTtlCalls.filter((c: unknown[]) =>
      (c[0] as { key: string }).key.includes("clientfingerprint"),
    );
    expect(fpCalls).toHaveLength(0);
  });

  it("should skip IP check when IP is localhost", async () => {
    const handler = createCheck(mocks);
    const info = createRequestInfo({
      clientIp: "127.0.0.1",
      clientFingerprint: undefined,
      city: undefined,
      countryCode: undefined,
    });
    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    // No getTtl calls should contain "ip" dimension
    const getTtlCalls = mocks.getTtlFn.mock.calls;
    expect(getTtlCalls).toHaveLength(0);
  });

  it("should skip city check when city is undefined", async () => {
    const handler = createCheck(mocks);
    const info = createRequestInfo({
      clientFingerprint: undefined,
      city: undefined,
      countryCode: undefined,
    });
    await handler.handleAsync({ requestInfo: info });

    // Should only check IP dimension (fingerprint and city skipped)
    const getTtlCalls = mocks.getTtlFn.mock.calls;
    const cityCalls = getTtlCalls.filter((c: unknown[]) =>
      (c[0] as { key: string }).key.includes("city"),
    );
    expect(cityCalls).toHaveLength(0);
  });

  it("should skip country check when countryCode is undefined", async () => {
    const handler = createCheck(mocks);
    const info = createRequestInfo({
      clientFingerprint: undefined,
      city: undefined,
      countryCode: undefined,
    });
    await handler.handleAsync({ requestInfo: info });

    const getTtlCalls = mocks.getTtlFn.mock.calls;
    const countryCalls = getTtlCalls.filter((c: unknown[]) =>
      (c[0] as { key: string }).key.includes("country"),
    );
    expect(countryCalls).toHaveLength(0);
  });

  it("should skip country check when countryCode is in whitelist", async () => {
    const handler = createCheck(mocks);
    const info = createRequestInfo({
      clientFingerprint: undefined,
      city: undefined,
      countryCode: "US",
    });
    await handler.handleAsync({ requestInfo: info });

    const getTtlCalls = mocks.getTtlFn.mock.calls;
    const countryCalls = getTtlCalls.filter((c: unknown[]) =>
      (c[0] as { key: string }).key.includes("country"),
    );
    expect(countryCalls).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Short-circuit
  // -----------------------------------------------------------------------

  it("should stop checking remaining dimensions after first block", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, { clientFingerprintThreshold: 50 });
    const info = createRequestInfo();
    const result = await handler.handleAsync({ requestInfo: info });

    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.ClientFingerprint);
    expect(result.data?.retryAfterMs).toBeDefined();

    // Should not have checked IP, city, or country after fingerprint blocked
    const getTtlCalls = mocks.getTtlFn.mock.calls;
    const ipCalls = getTtlCalls.filter((c: unknown[]) =>
      (c[0] as { key: string }).key.includes("blocked:ip:"),
    );
    expect(ipCalls).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Already-blocked
  // -----------------------------------------------------------------------

  it("should return blocked with remaining TTL when block key exists", async () => {
    mocks.getTtlFn.mockResolvedValue(
      D2Result.ok<DistributedCache.GetTtlOutput | undefined>({
        data: { timeToLiveMs: 180_000 },
      }),
    );

    const handler = createCheck(mocks);
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.retryAfterMs).toBe(180_000);
    // Increment should not have been called (short-circuited at getTtl)
    expect(mocks.incrementFn).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Fail-open
  // -----------------------------------------------------------------------

  it("should return not blocked when GetTtl handler fails", async () => {
    mocks.getTtlFn.mockRejectedValue(new Error("Redis down"));

    const handler = createCheck(mocks);
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should return not blocked when Increment handler fails", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.fail<DistributedCache.IncrementOutput | undefined>({
        statusCode: HttpStatusCode.ServiceUnavailable,
        errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      }),
    );

    const handler = createCheck(mocks);
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should default prevCount to 0 when previous window increment fails", async () => {
    let callCount = 0;
    mocks.incrementFn.mockImplementation(async () => {
      callCount++;
      // First call (prev window): failure
      if (callCount % 2 === 1) {
        return D2Result.fail<DistributedCache.IncrementOutput | undefined>({
          statusCode: HttpStatusCode.ServiceUnavailable,
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
        });
      }
      // Second call (current window): low count → not blocked
      return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 1 },
      });
    });

    const handler = createCheck(mocks, { clientFingerprintThreshold: 100 });
    const info = createRequestInfo({
      clientFingerprint: "fp",
      clientIp: "127.0.0.1",
      city: undefined,
      countryCode: undefined,
    });
    const result = await handler.handleAsync({ requestInfo: info });

    // prevCount defaults to 0, currCount=1, estimated < 100 → not blocked
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should default prevCount to 0 when prev window increment succeeds with undefined data", async () => {
    let callCount = 0;
    mocks.incrementFn.mockImplementation(async () => {
      callCount++;
      // First call (prev window): success but data is undefined
      if (callCount % 2 === 1) {
        return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
          data: undefined,
        });
      }
      // Second call (current window): low count
      return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 1 },
      });
    });

    const handler = createCheck(mocks, { clientFingerprintThreshold: 100 });
    const info = createRequestInfo({
      clientFingerprint: "fp",
      clientIp: "127.0.0.1",
      city: undefined,
      countryCode: undefined,
    });
    const result = await handler.handleAsync({ requestInfo: info });

    // prevCount defaults to 0 via ??, currCount=1, estimated < 100 → not blocked
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should default currCount to 0 when increment data is undefined", async () => {
    let callCount = 0;
    mocks.incrementFn.mockImplementation(async () => {
      callCount++;
      // First call (prev window): normal
      if (callCount % 2 === 1) {
        return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
          data: { newValue: 0 },
        });
      }
      // Second call (current window): success but data is undefined
      return D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: undefined,
      });
    });

    const handler = createCheck(mocks, { clientFingerprintThreshold: 100 });
    const info = createRequestInfo({
      clientFingerprint: "fp",
      clientIp: "127.0.0.1",
      city: undefined,
      countryCode: undefined,
    });
    const result = await handler.handleAsync({ requestInfo: info });

    // prevCount=0, currCount defaults to 0, estimated=0 < 100 → not blocked
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should return not blocked when Set handler fails during block", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );
    mocks.setFn.mockRejectedValue(new Error("Redis down"));

    const handler = createCheck(mocks, { clientFingerprintThreshold: 50 });
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    // The set failure is caught by the outer try/catch, so fail-open
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  it("should respect custom thresholds from options", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 10 },
      }),
    );

    const handler = createCheck(mocks, { clientFingerprintThreshold: 5 });
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result.data?.isBlocked).toBe(true);
  });

  it("should respect custom windowMs", async () => {
    const handler = createCheck(mocks, { windowMs: 120_000 });
    await handler.handleAsync({ requestInfo: createRequestInfo() });

    // Counter TTL should be 2 * 120_000 = 240_000
    const incrementCalls = mocks.incrementFn.mock.calls;
    for (const call of incrementCalls) {
      expect(call[0].expirationMs).toBe(240_000);
    }
  });

  it("should respect custom blockDurationMs", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 50,
      blockDurationMs: 600_000,
    });
    const result = await handler.handleAsync({ requestInfo: createRequestInfo() });

    expect(result.data?.retryAfterMs).toBe(600_000);
  });

  it("should respect custom whitelistedCountryCodes", async () => {
    mocks.incrementFn.mockResolvedValue(
      D2Result.ok<DistributedCache.IncrementOutput | undefined>({
        data: { newValue: 200 },
      }),
    );

    // FR is normally not whitelisted, but we add it
    const handler = createCheck(mocks, {
      clientFingerprintThreshold: 1000,
      ipThreshold: 1000,
      cityThreshold: 1000,
      countryThreshold: 50,
      whitelistedCountryCodes: ["US", "CA", "GB", "FR"],
    });
    const info = createRequestInfo({
      clientFingerprint: undefined,
      city: undefined,
      countryCode: "FR",
    });
    const result = await handler.handleAsync({ requestInfo: info });

    // FR is whitelisted, so country check is skipped → not blocked
    expect(result.data?.isBlocked).toBe(false);
  });
});
