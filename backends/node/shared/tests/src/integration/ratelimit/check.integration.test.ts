import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Check, RateLimitDimension } from "@d2/ratelimit";
import { GetTtl, Increment, Set } from "@d2/cache-redis";
import type { IRequestInfo } from "@d2/request-enrichment";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "../cache-redis/redis-test-helpers.js";

function createRequestInfo(overrides?: Partial<IRequestInfo>): IRequestInfo {
  return {
    clientIp: "10.20.30.40",
    serverFingerprint: "a".repeat(64),
    clientFingerprint: "integration-fp",
    whoIsHashId: undefined,
    city: undefined,
    countryCode: undefined,
    subdivisionCode: undefined,
    isVpn: false,
    isProxy: false,
    isTor: false,
    isHosting: false,
    userId: undefined,
    isAuthenticated: false,
    isTrustedService: false,
    ...overrides,
  };
}

describe("RateLimit Check handler (integration with Redis)", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  function createCheckHandler(options?: Record<string, unknown>): Check {
    const redis = getRedis();
    const context = createTestContext();
    return new Check(
      new GetTtl(redis, context),
      new Increment(redis, context),
      new Set<string>(redis, context),
      options ?? {},
      context,
    );
  }

  it("should allow requests below threshold", async () => {
    const handler = createCheckHandler({ clientFingerprintThreshold: 10 });
    const info = createRequestInfo();

    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(false);
  });

  it("should block after threshold is exceeded and create block key in Redis", async () => {
    const handler = createCheckHandler({ clientFingerprintThreshold: 3 });
    const info = createRequestInfo();

    // Send requests until blocked
    let blocked = false;
    for (let i = 0; i < 10; i++) {
      const result = await handler.handleAsync({ requestInfo: info });
      if (result.data?.isBlocked) {
        blocked = true;
        expect(result.data.blockedDimension).toBe(RateLimitDimension.ClientFingerprint);
        expect(result.data.retryAfterMs).toBeDefined();
        break;
      }
    }
    expect(blocked).toBe(true);

    // Verify the block key exists in Redis
    const redis = getRedis();
    const blockKey = `blocked:clientfingerprint:integration-fp`;
    const pttl = await redis.pttl(blockKey);
    expect(pttl).toBeGreaterThan(0);
  });

  it("should set counter keys with correct TTL", async () => {
    const handler = createCheckHandler({
      clientFingerprintThreshold: 1000,
      windowMs: 60_000,
    });
    const info = createRequestInfo();

    await handler.handleAsync({ requestInfo: info });

    // Find the counter key
    const redis = getRedis();
    const keys = await redis.keys("ratelimit:clientfingerprint:integration-fp:*");
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
    await redis.set("blocked:clientfingerprint:integration-fp", "1", "PX", 60_000);

    const handler = createCheckHandler();
    const info = createRequestInfo();

    const result = await handler.handleAsync({ requestInfo: info });

    expect(result).toBeSuccess();
    expect(result.data?.isBlocked).toBe(true);
    expect(result.data?.blockedDimension).toBe(RateLimitDimension.ClientFingerprint);
    expect(result.data?.retryAfterMs).toBeGreaterThan(0);
    expect(result.data!.retryAfterMs!).toBeLessThanOrEqual(60_000);
  });

  it("should correctly count across requests using real Redis counters", async () => {
    const handler = createCheckHandler({
      clientFingerprintThreshold: 5,
      windowMs: 60_000,
    });
    const info = createRequestInfo();

    // Send 4 requests (below threshold)
    for (let i = 0; i < 4; i++) {
      const result = await handler.handleAsync({ requestInfo: info });
      expect(result.data?.isBlocked).toBe(false);
    }

    // Verify counter value in Redis
    const redis = getRedis();
    const keys = await redis.keys("ratelimit:clientfingerprint:integration-fp:*");
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
});
