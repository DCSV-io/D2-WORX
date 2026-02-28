import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AcquireLock } from "@d2/cache-redis";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.AcquireLock", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should acquire lock when key does not exist", async () => {
    const redis = getRedis();
    const handler = new AcquireLock(redis, createTestContext());
    const result = await handler.handleAsync({
      key: "lock:test",
      lockId: "owner-1",
      expirationMs: 60_000,
    });

    expect(result).toBeSuccess();
    expect(result.data?.acquired).toBe(true);

    const stored = await redis.get("lock:test");
    expect(stored).toBe("owner-1");
  });

  it("should not acquire lock when key already exists", async () => {
    const redis = getRedis();
    const handler = new AcquireLock(redis, createTestContext());

    await handler.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 60_000 });
    const result = await handler.handleAsync({
      key: "lock:test",
      lockId: "owner-2",
      expirationMs: 60_000,
    });

    expect(result).toBeSuccess();
    expect(result.data?.acquired).toBe(false);

    const stored = await redis.get("lock:test");
    expect(stored).toBe("owner-1");
  });

  it("should set expiration on acquired lock", async () => {
    const redis = getRedis();
    const handler = new AcquireLock(redis, createTestContext());
    await handler.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 60_000 });

    const pttl = await redis.pttl("lock:test");
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(60_000);
  });

  it("should allow re-acquire after lock expires", async () => {
    const redis = getRedis();
    const handler = new AcquireLock(redis, createTestContext());

    await handler.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 100 });
    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await handler.handleAsync({
      key: "lock:test",
      lockId: "owner-2",
      expirationMs: 60_000,
    });

    expect(result).toBeSuccess();
    expect(result.data?.acquired).toBe(true);

    const stored = await redis.get("lock:test");
    expect(stored).toBe("owner-2");
  });
});
