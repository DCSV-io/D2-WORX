import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import * as CacheRedis from "@d2/cache-redis";
import { createSecondaryStorage } from "@d2/auth-infra";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

/**
 * Tests `createSecondaryStorage()` with real @d2/cache-redis handlers
 * against a real Redis instance.
 *
 * Key focus: TTL conversion (BetterAuth passes seconds, handlers expect ms),
 * set/get/delete round-trip, and TTL expiration.
 */
describe("createSecondaryStorage (integration)", () => {
  let storage: ReturnType<typeof createSecondaryStorage>;

  beforeAll(async () => {
    await startRedis();
    const ctx = createTestContext();
    const redis = getRedis();

    storage = createSecondaryStorage({
      get: new CacheRedis.Get<string>(redis, ctx),
      set: new CacheRedis.Set<string>(redis, ctx),
      remove: new CacheRedis.Remove(redis, ctx),
    });
  }, 120_000);

  afterAll(async () => {
    await stopRedis();
  });

  beforeEach(async () => {
    await flushRedis();
  });

  it("should return null for a missing key", async () => {
    const value = await storage.get("nonexistent-key");
    expect(value).toBeNull();
  });

  it("should round-trip set + get", async () => {
    await storage.set("test-key", "test-value");
    const value = await storage.get("test-key");
    expect(value).toBe("test-value");
  });

  it("should expire keys based on TTL (seconds)", async () => {
    // Set with 1-second TTL
    await storage.set("ttl-key", "expires-soon", 1);

    // Should exist immediately
    const immediate = await storage.get("ttl-key");
    expect(immediate).toBe("expires-soon");

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 1500));

    const expired = await storage.get("ttl-key");
    expect(expired).toBeNull();
  });

  it("should delete a previously stored key", async () => {
    await storage.set("delete-me", "some-value");
    const before = await storage.get("delete-me");
    expect(before).toBe("some-value");

    await storage.delete("delete-me");
    const after = await storage.get("delete-me");
    expect(after).toBeNull();
  });

  it("should convert TTL from seconds to milliseconds correctly", async () => {
    // Set with TTL = 2 seconds. The handler stores in Redis with PX (ms).
    await storage.set("ttl-check", "value", 2);

    // Verify Redis key has a TTL of ~2000ms (not 2ms or 2000000ms)
    const redis = getRedis();
    const pttl = await redis.pttl("ttl-check");

    // Should be between 1000 and 2100 ms (allowing some tolerance)
    expect(pttl).toBeGreaterThan(1000);
    expect(pttl).toBeLessThanOrEqual(2100);
  });

  it("should handle multiple independent keys", async () => {
    await storage.set("key-a", "value-a");
    await storage.set("key-b", "value-b");

    expect(await storage.get("key-a")).toBe("value-a");
    expect(await storage.get("key-b")).toBe("value-b");

    // Deleting one shouldn't affect the other
    await storage.delete("key-a");
    expect(await storage.get("key-a")).toBeNull();
    expect(await storage.get("key-b")).toBe("value-b");
  });
});
