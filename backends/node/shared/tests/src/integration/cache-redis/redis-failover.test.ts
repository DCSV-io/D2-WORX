import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { Get, Set, Exists, Remove, GetTtl, Increment } from "@d2/cache-redis";
import { ErrorCodes } from "@d2/result";
import { createTestContext } from "./redis-test-helpers.js";

/**
 * Validates fail-open behavior when Redis becomes unavailable mid-operation.
 * Starts a real Redis container, runs a successful cycle, then stops it
 * and verifies handlers return D2Result.fail(SERVICE_UNAVAILABLE) — not throw.
 */
describe("Redis failover — cache-redis handlers", () => {
  let container: StartedRedisContainer;
  let redis: Redis;

  beforeAll(async () => {
    container = await new RedisContainer("redis:8.2").start();
    redis = new Redis({
      host: container.getHost(),
      port: container.getFirstMappedPort(),
      lazyConnect: false,
      retryStrategy: () => null, // Disable reconnect — we want immediate failures
    });
  }, 60_000);

  afterAll(async () => {
    await redis?.quit().catch(() => {});
    // Container may already be stopped by the test
    await container?.stop().catch(() => {});
  });

  it("should return SERVICE_UNAVAILABLE from all handlers after Redis stops", async () => {
    const ctx = createTestContext();

    // 1. Verify normal operation
    const setHandler = new Set<string>(redis, ctx);
    const getHandler = new Get<string>(redis, ctx);

    const setResult = await setHandler.handleAsync({ key: "failover-test", value: "hello" });
    expect(setResult).toBeSuccess();

    const getResult = await getHandler.handleAsync({ key: "failover-test" });
    expect(getResult).toBeSuccess();
    expect(getResult.data?.value).toBe("hello");

    // 2. Stop Redis mid-test
    await container.stop();

    // 3. All handlers should return SERVICE_UNAVAILABLE (not throw)
    const getAfter = await getHandler.handleAsync({ key: "failover-test" });
    expect(getAfter).toBeFailure();
    expect(getAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);

    const setAfter = await setHandler.handleAsync({ key: "failover-test", value: "world" });
    expect(setAfter).toBeFailure();
    expect(setAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);

    const existsHandler = new Exists(redis, ctx);
    const existsAfter = await existsHandler.handleAsync({ key: "failover-test" });
    expect(existsAfter).toBeFailure();
    expect(existsAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);

    const removeHandler = new Remove(redis, ctx);
    const removeAfter = await removeHandler.handleAsync({ key: "failover-test" });
    expect(removeAfter).toBeFailure();
    expect(removeAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);

    const getTtlHandler = new GetTtl(redis, ctx);
    const getTtlAfter = await getTtlHandler.handleAsync({ key: "failover-test" });
    expect(getTtlAfter).toBeFailure();
    expect(getTtlAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);

    const incrHandler = new Increment(redis, ctx);
    const incrAfter = await incrHandler.handleAsync({ key: "failover-counter", amount: 1 });
    expect(incrAfter).toBeFailure();
    expect(incrAfter.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
  }, 30_000);
});
