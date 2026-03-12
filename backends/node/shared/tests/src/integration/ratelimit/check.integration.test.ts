import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { CheckRateLimit, RateLimitDimension } from "@d2/ratelimit";
import { GetTtl, Increment, Set } from "@d2/cache-redis";
import type { IRequestContext } from "@d2/handler";
import Redis from "ioredis";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "../cache-redis/redis-test-helpers.js";

function createRequestContext(overrides?: Partial<IRequestContext>): IRequestContext {
  return {
    clientIp: "10.20.30.40",
    serverFingerprint: "a".repeat(64),
    clientFingerprint: "integration-fp",
    deviceFingerprint: "b".repeat(64),
    whoIsHashId: undefined,
    city: undefined,
    countryCode: undefined,
    subdivisionCode: undefined,
    isVpn: false,
    isProxy: false,
    isTor: false,
    isHosting: false,
    isAuthenticated: false,
    isTrustedService: false,
    isOrgEmulating: false,
    isUserImpersonating: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    ...overrides,
  };
}

describe("RateLimit Check handler (integration with Redis)", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  function createCheckHandler(options?: Record<string, unknown>): CheckRateLimit {
    const redis = getRedis();
    const context = createTestContext();
    return new CheckRateLimit(
      new GetTtl(redis, context),
      new Increment(redis, context),
      new Set<string>(redis, context),
      options ?? {},
      context,
    );
  }

  it("should allow requests below threshold", async () => {
    const handler = createCheckHandler({ deviceFingerprintThreshold: 10 });
    const info = createRequestContext();

    const result = await handler.handleAsync({ requestContext: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should block after threshold is exceeded and create block key in Redis", async () => {
    const handler = createCheckHandler({ deviceFingerprintThreshold: 3 });
    const info = createRequestContext();

    // Send requests until blocked
    let blocked = false;
    for (let i = 0; i < 10; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      if (result.data?.isBlocked) {
        blocked = true;
        expect(result.data.blockedDimension).toBe(RateLimitDimension.DeviceFingerprint);
        expect(result.data.retryAfterMs).toBeDefined();
        break;
      }
    }
    expect(blocked).toBe(true);

    // Verify the block key exists in Redis
    const redis = getRedis();
    const blockKey = `blocked:devicefingerprint:${"b".repeat(64)}`;
    const pttl = await redis.pttl(blockKey);
    expect(pttl).toBeGreaterThan(0);
  });

  it("should set counter keys with correct TTL", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 1000,
      windowMs: 60_000,
    });
    const info = createRequestContext();

    await handler.handleAsync({ requestContext: info });

    // Find the counter key
    const redis = getRedis();
    const keys = await redis.keys(`ratelimit:devicefingerprint:${"b".repeat(64)}:*`);
    expect(keys.length).toBeGreaterThanOrEqual(1);

    // Check TTL is approximately 2 * 60_000 = 120_000ms
    for (const key of keys) {
      const pttl = await redis.pttl(key);
      // TTL should be > 0 and <= 120_000
      if (pttl > 0) {
        expect(pttl).toBeLessThanOrEqual(120_000);
      }
    }
  });

  it("should return already-blocked state with correct remaining TTL", async () => {
    const redis = getRedis();
    // Pre-set a block key
    await redis.set(`blocked:devicefingerprint:${"b".repeat(64)}`, "1", "PX", 60_000);

    const handler = createCheckHandler();
    const info = createRequestContext();

    const result = await handler.handleAsync({ requestContext: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.DeviceFingerprint);
    expect(result.data?.retryAfterMs).toBeGreaterThan(0);
    expect(result.data!.retryAfterMs!).toBeLessThanOrEqual(60_000);
  });

  it("should correctly count across requests using real Redis counters", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 5,
      windowMs: 60_000,
    });
    const info = createRequestContext();

    // Send 4 requests (below threshold)
    for (let i = 0; i < 4; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      expect(result.data?.isBlocked).toBe(false);
    }

    // Verify counter value in Redis
    const redis = getRedis();
    const keys = await redis.keys(`ratelimit:devicefingerprint:${"b".repeat(64)}:*`);
    const currentKeys = keys.filter((k) => !k.includes("blocked"));
    expect(currentKeys.length).toBeGreaterThanOrEqual(1);

    // At least one counter should have value >= 4
    let foundCounter = false;
    for (const key of currentKeys) {
      const val = await redis.get(key);
      if (val && parseInt(val, 10) >= 4) {
        foundCounter = true;
      }
    }
    expect(foundCounter).toBe(true);
  });

  // ─── Gap 1: Trusted service bypass ──────────────────────────────────────────

  it("should bypass all rate limiting for trusted services and create no Redis keys", async () => {
    const handler = createCheckHandler({ deviceFingerprintThreshold: 1 });
    const info = createRequestContext({ isTrustedService: true });

    // Even with threshold=1, trusted services should never be blocked
    for (let i = 0; i < 5; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      expect(result).toBeSuccess();
      expect(result.data?.isBlocked).toBe(false);
      expect(result.data?.blockedDimension).toBeUndefined();
      expect(result.data?.retryAfterMs).toBeUndefined();
    }

    // Verify NO Redis keys were created (no counters, no blocks)
    const redis = getRedis();
    const allKeys = await redis.keys("*");
    expect(allKeys).toHaveLength(0);
  });

  it("should bypass rate limiting for trusted services even when block keys pre-exist", async () => {
    const redis = getRedis();
    // Pre-set a block key for the device fingerprint
    await redis.set(`blocked:devicefingerprint:${"b".repeat(64)}`, "1", "PX", 60_000);

    const handler = createCheckHandler();
    const info = createRequestContext({ isTrustedService: true });

    const result = await handler.handleAsync({ requestContext: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  // ─── Gap 2: Country whitelist bypass ────────────────────────────────────────

  it("should skip country-level rate limiting for whitelisted country codes (US)", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 100_000,
      countryThreshold: 1, // Would block immediately if checked
    });
    const info = createRequestContext({
      countryCode: "US",
      clientIp: "203.0.113.1",
    });

    // Send multiple requests — should NOT be blocked on country despite threshold=1
    for (let i = 0; i < 5; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      expect(result).toBeSuccess();
      expect(result.data?.isBlocked).toBe(false);
    }

    // Verify no country-level Redis keys exist
    const redis = getRedis();
    const countryKeys = await redis.keys("ratelimit:country:*");
    expect(countryKeys).toHaveLength(0);
    const countryBlockKeys = await redis.keys("blocked:country:*");
    expect(countryBlockKeys).toHaveLength(0);
  });

  it("should skip country-level rate limiting for whitelisted country codes (CA, GB)", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 100_000,
      countryThreshold: 1,
    });

    for (const code of ["CA", "GB"]) {
      await flushRedis();
      const info = createRequestContext({
        countryCode: code,
        clientIp: "203.0.113.2",
      });

      const result = await handler.handleAsync({ requestContext: info });
      expect(result).toBeSuccess();
      expect(result.data?.isBlocked).toBe(false);

      const redis = getRedis();
      const countryKeys = await redis.keys("ratelimit:country:*");
      expect(countryKeys).toHaveLength(0);
    }
  });

  it("should enforce country-level rate limiting for non-whitelisted country codes (DE)", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 100_000,
      cityThreshold: 100_000,
      countryThreshold: 2,
    });
    const info = createRequestContext({
      countryCode: "DE",
      clientIp: "203.0.113.3",
    });

    // Send requests — country counter keys SHOULD be created
    await handler.handleAsync({ requestContext: info });

    const redis = getRedis();
    const countryKeys = await redis.keys("ratelimit:country:DE:*");
    expect(countryKeys.length).toBeGreaterThanOrEqual(1);
  });

  it("should block on country dimension when non-whitelisted country exceeds threshold", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 100_000,
      cityThreshold: 100_000,
      countryThreshold: 2,
    });
    const info = createRequestContext({
      countryCode: "DE",
      clientIp: "203.0.113.4",
    });

    let blocked = false;
    for (let i = 0; i < 10; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      if (result.data?.isBlocked) {
        blocked = true;
        expect(result.data.blockedDimension).toBe(RateLimitDimension.Country);
        break;
      }
    }
    expect(blocked).toBe(true);

    // Verify the block key exists in Redis
    const redis = getRedis();
    const blockKey = `blocked:country:DE`;
    const pttl = await redis.pttl(blockKey);
    expect(pttl).toBeGreaterThan(0);
  });

  // ─── Gap 3: Fail-open on Redis errors ──────────────────────────────────────

  it("should fail-open (allow requests) when Redis is unreachable", async () => {
    // Create a handler with a broken Redis connection (invalid port)
    const brokenRedis = new Redis({
      host: "127.0.0.1",
      port: 1, // Invalid port — nothing is listening here
      lazyConnect: true,
      retryStrategy: () => null, // No retries
      maxRetriesPerRequest: 0,
      connectTimeout: 500,
      enableOfflineQueue: false,
    });

    const context = createTestContext();
    const handler = new CheckRateLimit(
      new GetTtl(brokenRedis, context),
      new Increment(brokenRedis, context),
      new Set<string>(brokenRedis, context),
      { deviceFingerprintThreshold: 1 }, // Very low threshold
      context,
    );

    const info = createRequestContext();

    // Should allow the request even though Redis is down (fail-open)
    const result = await handler.handleAsync({ requestContext: info });
    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);

    // Cleanup: disconnect the broken redis
    brokenRedis.disconnect();
  });

  // ─── Gap 4: Per-dimension threshold enforcement ────────────────────────────

  it("should block on IP dimension independently when IP threshold is exceeded", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000, // Very high — won't trigger
      ipThreshold: 3, // Very low — will trigger
      cityThreshold: 100_000,
      countryThreshold: 100_000,
    });
    const info = createRequestContext({
      clientIp: "198.51.100.1", // Non-localhost IP
    });

    // Send requests until IP dimension blocks
    const results: Array<{ isBlocked: boolean; dimension: string | undefined }> = [];
    for (let i = 0; i < 10; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      results.push({
        isBlocked: result.data?.isBlocked ?? false,
        dimension: result.data?.blockedDimension,
      });
      if (result.data?.isBlocked) break;
    }

    // Should eventually block specifically on IP dimension
    const blockResult = results.find((r) => r.isBlocked);
    expect(blockResult).toBeDefined();
    expect(blockResult!.dimension).toBe(RateLimitDimension.Ip);

    // Verify the IP block key exists
    const redis = getRedis();
    const ipBlockKey = `blocked:ip:198.51.100.1`;
    const pttl = await redis.pttl(ipBlockKey);
    expect(pttl).toBeGreaterThan(0);

    // Verify the device fingerprint block key does NOT exist
    const fpBlockKey = `blocked:devicefingerprint:${"b".repeat(64)}`;
    const fpPttl = await redis.pttl(fpBlockKey);
    expect(fpPttl).toBe(-2); // -2 = key does not exist
  });

  it("should block on city dimension independently when city threshold is exceeded", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 100_000,
      cityThreshold: 3,
      countryThreshold: 100_000,
    });
    const info = createRequestContext({
      clientIp: "198.51.100.2",
      city: "Berlin",
    });

    let blocked = false;
    for (let i = 0; i < 10; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      if (result.data?.isBlocked) {
        blocked = true;
        expect(result.data.blockedDimension).toBe(RateLimitDimension.City);
        break;
      }
    }
    expect(blocked).toBe(true);

    // Verify city block key exists
    const redis = getRedis();
    const cityBlockKey = `blocked:city:Berlin`;
    const pttl = await redis.pttl(cityBlockKey);
    expect(pttl).toBeGreaterThan(0);
  });

  it("should skip IP dimension for localhost addresses", async () => {
    const handler = createCheckHandler({
      deviceFingerprintThreshold: 100_000,
      ipThreshold: 1, // Would block immediately if checked
    });
    const info = createRequestContext({
      clientIp: "127.0.0.1",
    });

    // Send multiple requests — should NOT be blocked on IP despite threshold=1
    for (let i = 0; i < 5; i++) {
      const result = await handler.handleAsync({ requestContext: info });
      expect(result).toBeSuccess();
      expect(result.data?.isBlocked).toBe(false);
    }

    // Verify no IP-level Redis keys exist
    const redis = getRedis();
    const ipKeys = await redis.keys("ratelimit:ip:*");
    expect(ipKeys).toHaveLength(0);
    const ipBlockKeys = await redis.keys("blocked:ip:*");
    expect(ipBlockKeys).toHaveLength(0);
  });
});
