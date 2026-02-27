import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import * as CacheRedis from "@d2/cache-redis";
import { ErrorCodes } from "@d2/result";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { createSecondaryStorage } from "@d2/auth-infra";
import { Check as RateLimitCheck } from "@d2/ratelimit";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "redis-failover-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

/**
 * Validates fail-open behavior for auth-level Redis consumers:
 *   1. Secondary storage (BetterAuth session cache)
 *   2. Rate limiter (distributed sliding window)
 *
 * When Redis dies, auth should degrade gracefully:
 *   - Secondary storage returns null → BetterAuth falls through to PG
 *   - Rate limiter fails open → requests pass through unblocked
 */
describe("Redis failover — auth service consumers", () => {
  let container: StartedRedisContainer;
  let redis: Redis;

  beforeAll(async () => {
    container = await new RedisContainer("redis:8.2").start();
    redis = new Redis({
      host: container.getHost(),
      port: container.getFirstMappedPort(),
      lazyConnect: false,
      retryStrategy: () => null,
    });
  }, 60_000);

  afterAll(async () => {
    await redis?.quit().catch(() => {});
    await container?.stop().catch(() => {});
  });

  it("should degrade secondary storage gracefully when Redis stops", async () => {
    const ctx = createTestContext();
    const redisGet = new CacheRedis.Get<string>(redis, ctx);
    const redisSet = new CacheRedis.Set<string>(redis, ctx);
    const redisRemove = new CacheRedis.Remove(redis, ctx);
    const storage = createSecondaryStorage({ get: redisGet, set: redisSet, remove: redisRemove });

    // 1. Normal operation
    await storage.set("session:test", "session-data", 300);
    const value = await storage.get("session:test");
    expect(value).toBe("session-data");

    // 2. Stop Redis
    await container.stop();

    // 3. Secondary storage should return null (not throw)
    const afterStop = await storage.get("session:test");
    expect(afterStop).toBeNull();

    // 4. Set/delete should not throw
    await expect(storage.set("session:test", "new-data", 300)).resolves.not.toThrow();
    await expect(storage.delete("session:test")).resolves.not.toThrow();
  }, 30_000);

  it("should fail-open on rate limiter when Redis stops", async () => {
    // Start a fresh container for this test (previous one was stopped)
    const freshContainer = await new RedisContainer("redis:8.2").start();
    const freshRedis = new Redis({
      host: freshContainer.getHost(),
      port: freshContainer.getFirstMappedPort(),
      lazyConnect: false,
      retryStrategy: () => null,
    });

    try {
      const ctx = createTestContext();
      const getTtl = new CacheRedis.GetTtl(freshRedis, ctx);
      const increment = new CacheRedis.Increment(freshRedis, ctx);
      const set = new CacheRedis.Set<string>(freshRedis, ctx);
      const rateLimitCheck = new RateLimitCheck(getTtl, increment, set, {}, ctx);

      // 1. Normal check — should pass
      const normalResult = await rateLimitCheck.handleAsync({
        requestInfo: {
          clientIp: "203.0.113.1",
          clientFingerprint: "fp-test",
        },
      });
      expect(normalResult).toBeSuccess();
      expect(normalResult.data?.isBlocked).toBe(false);

      // 2. Stop Redis
      await freshContainer.stop();

      // 3. Rate limiter should fail-open (not blocked, not throwing)
      const failoverResult = await rateLimitCheck.handleAsync({
        requestInfo: {
          clientIp: "203.0.113.1",
          clientFingerprint: "fp-test",
        },
      });
      expect(failoverResult).toBeSuccess();
      expect(failoverResult.data?.isBlocked).toBe(false);
    } finally {
      await freshRedis.quit().catch(() => {});
      await freshContainer.stop().catch(() => {});
    }
  }, 60_000);
});
