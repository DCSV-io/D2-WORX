import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { AcquireLock, ReleaseLock } from "@d2/cache-redis";
import { startRedis, stopRedis, getRedis, flushRedis, createTestContext } from "./redis-test-helpers.js";

describe("DistributedCache.ReleaseLock", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should release lock when lockId matches", async () => {
    const redis = getRedis();
    const ctx = createTestContext();
    const acquire = new AcquireLock(redis, ctx);
    const release = new ReleaseLock(redis, ctx);

    await acquire.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 60_000 });
    const result = await release.handleAsync({ key: "lock:test", lockId: "owner-1" });

    expect(result).toBeSuccess();
    expect(result.data?.released).toBe(true);

    const stored = await redis.get("lock:test");
    expect(stored).toBeNull();
  });

  it("should not release lock when lockId does not match", async () => {
    const redis = getRedis();
    const ctx = createTestContext();
    const acquire = new AcquireLock(redis, ctx);
    const release = new ReleaseLock(redis, ctx);

    await acquire.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 60_000 });
    const result = await release.handleAsync({ key: "lock:test", lockId: "owner-2" });

    expect(result).toBeSuccess();
    expect(result.data?.released).toBe(false);

    const stored = await redis.get("lock:test");
    expect(stored).toBe("owner-1");
  });

  it("should return released: false when key does not exist", async () => {
    const redis = getRedis();
    const release = new ReleaseLock(redis, createTestContext());
    const result = await release.handleAsync({ key: "lock:nonexistent", lockId: "owner-1" });

    expect(result).toBeSuccess();
    expect(result.data?.released).toBe(false);
  });

  it("should not release expired lock re-acquired by another instance", async () => {
    const redis = getRedis();
    const ctx = createTestContext();
    const acquire = new AcquireLock(redis, ctx);
    const release = new ReleaseLock(redis, ctx);

    // Owner-1 acquires with short TTL
    await acquire.handleAsync({ key: "lock:test", lockId: "owner-1", expirationMs: 100 });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Owner-2 acquires after expiry
    await acquire.handleAsync({ key: "lock:test", lockId: "owner-2", expirationMs: 60_000 });

    // Owner-1 tries to release — should fail (owner-2 holds it now)
    const result = await release.handleAsync({ key: "lock:test", lockId: "owner-1" });
    expect(result).toBeSuccess();
    expect(result.data?.released).toBe(false);

    // Owner-2's lock should be intact
    const stored = await redis.get("lock:test");
    expect(stored).toBe("owner-2");
  });
});
