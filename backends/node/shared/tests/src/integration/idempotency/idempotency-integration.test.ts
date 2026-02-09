import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SetNx, Set, Get, Remove } from "@d2/cache-redis";
import { Check } from "@d2/idempotency";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "../cache-redis/redis-test-helpers.js";

describe("Idempotency integration (Redis)", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  describe("SetNx handler", () => {
    it("should set value when key does not exist", async () => {
      const redis = getRedis();
      const handler = new SetNx<string>(redis, createTestContext());
      const result = await handler.handleAsync({ key: "k1", value: "val", expirationMs: 10_000 });

      expect(result).toBeSuccess();
      expect(result.data?.wasSet).toBe(true);

      const stored = await redis.get("k1");
      expect(JSON.parse(stored!)).toBe("val");
    });

    it("should not set value when key already exists", async () => {
      const redis = getRedis();
      await redis.set("k1", '"existing"');

      const handler = new SetNx<string>(redis, createTestContext());
      const result = await handler.handleAsync({ key: "k1", value: "new-val" });

      expect(result).toBeSuccess();
      expect(result.data?.wasSet).toBe(false);

      // Original value preserved
      const stored = await redis.get("k1");
      expect(JSON.parse(stored!)).toBe("existing");
    });

    it("should set with expiration", async () => {
      const redis = getRedis();
      const handler = new SetNx<string>(redis, createTestContext());
      await handler.handleAsync({ key: "k1", value: "val", expirationMs: 60_000 });

      const pttl = await redis.pttl("k1");
      expect(pttl).toBeGreaterThan(0);
      expect(pttl).toBeLessThanOrEqual(60_000);
    });
  });

  describe("Full idempotency flow", () => {
    it("should acquire lock, then return cached on second request", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const set = new Set<string>(redis, ctx);

      const handler = new Check(setNx, get, {}, ctx);

      // First request: should acquire lock
      const result1 = await handler.handleAsync({ idempotencyKey: "key-1" });
      expect(result1).toBeSuccess();
      expect(result1.data?.state).toBe("acquired");

      // Simulate storing a cached response
      const cachedResponse = JSON.stringify({
        statusCode: 201,
        body: '{"id":"123"}',
        contentType: "application/json",
      });
      await set.handleAsync({
        key: "idempotency:key-1",
        value: cachedResponse,
        expirationMs: 86_400_000,
      });

      // Second request: should return cached
      const result2 = await handler.handleAsync({ idempotencyKey: "key-1" });
      expect(result2).toBeSuccess();
      expect(result2.data?.state).toBe("cached");
      expect(result2.data?.cachedResponse?.statusCode).toBe(201);
      expect(result2.data?.cachedResponse?.body).toBe('{"id":"123"}');
    });

    it("should return in_flight when sentinel exists", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);

      const handler = new Check(setNx, get, {}, ctx);

      // First request: acquires lock
      const result1 = await handler.handleAsync({ idempotencyKey: "key-2" });
      expect(result1.data?.state).toBe("acquired");

      // Second request (sentinel still present): should return in_flight
      const result2 = await handler.handleAsync({ idempotencyKey: "key-2" });
      expect(result2).toBeSuccess();
      expect(result2.data?.state).toBe("in_flight");
    });

    it("should allow retry after sentinel expires", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);

      // Use very short TTL for test
      const handler = new Check(setNx, get, { inFlightTtlMs: 100 }, ctx);

      // First request: acquires lock
      const result1 = await handler.handleAsync({ idempotencyKey: "key-3" });
      expect(result1.data?.state).toBe("acquired");

      // Wait for sentinel to expire
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Third request after expiry: should acquire again
      const result3 = await handler.handleAsync({ idempotencyKey: "key-3" });
      expect(result3).toBeSuccess();
      expect(result3.data?.state).toBe("acquired");
    });

    it("should clean up sentinel via remove handler", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const remove = new Remove(redis, ctx);

      const handler = new Check(setNx, get, {}, ctx);

      // Acquire lock
      await handler.handleAsync({ idempotencyKey: "key-4" });

      // Remove sentinel (simulating non-cacheable response cleanup)
      await remove.handleAsync({ key: "idempotency:key-4" });

      // Next request should acquire again
      const result = await handler.handleAsync({ idempotencyKey: "key-4" });
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });
  });

  describe("Serialization round-trip (real Redis)", () => {
    it("should round-trip CachedResponse with Unicode body through Redis", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const set = new Set<string>(redis, ctx);
      const handler = new Check(setNx, get, {}, ctx);

      // Acquire lock
      const result1 = await handler.handleAsync({ idempotencyKey: "unicode-1" });
      expect(result1.data?.state).toBe("acquired");

      // Store CachedResponse with Unicode
      const cached = {
        statusCode: 200,
        body: '{"city":"日本語","emoji":"🎉","accent":"café"}',
        contentType: "application/json; charset=utf-8",
      };
      await set.handleAsync({
        key: "idempotency:unicode-1",
        value: JSON.stringify(cached),
        expirationMs: 60_000,
      });

      // Retrieve and verify round-trip
      const result2 = await handler.handleAsync({ idempotencyKey: "unicode-1" });
      expect(result2).toBeSuccess();
      expect(result2.data?.state).toBe("cached");
      expect(result2.data?.cachedResponse?.statusCode).toBe(200);
      expect(result2.data?.cachedResponse?.body).toContain("日本語");
      expect(result2.data?.cachedResponse?.body).toContain("🎉");
      expect(result2.data?.cachedResponse?.body).toContain("café");
      expect(result2.data?.cachedResponse?.contentType).toBe("application/json; charset=utf-8");
    });

    it("should round-trip CachedResponse with nested escaped JSON through Redis", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const set = new Set<string>(redis, ctx);
      const handler = new Check(setNx, get, {}, ctx);

      await handler.handleAsync({ idempotencyKey: "nested-1" });

      // Body contains JSON that itself contains escaped JSON.
      const nestedBody = '{"data":"{\\"key\\":\\"value\\"}","quote":"He said \\"hello\\""}';
      const cached = { statusCode: 201, body: nestedBody, contentType: "application/json" };

      await set.handleAsync({
        key: "idempotency:nested-1",
        value: JSON.stringify(cached),
        expirationMs: 60_000,
      });

      const result = await handler.handleAsync({ idempotencyKey: "nested-1" });
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.body).toBe(nestedBody);
    });

    it("should round-trip CachedResponse with null body (204 No Content) through Redis", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const set = new Set<string>(redis, ctx);
      const handler = new Check(setNx, get, {}, ctx);

      await handler.handleAsync({ idempotencyKey: "no-content-1" });

      const cached = { statusCode: 204 };
      await set.handleAsync({
        key: "idempotency:no-content-1",
        value: JSON.stringify(cached),
        expirationMs: 60_000,
      });

      const result = await handler.handleAsync({ idempotencyKey: "no-content-1" });
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.statusCode).toBe(204);
      expect(result.data?.cachedResponse?.body).toBeUndefined();
    });

    it("should handle double-serialization correctly (string value goes through JSON serializer)", async () => {
      // This tests the actual Redis path: SetNx<string> serializes the string value
      // as JSON (wrapping in quotes), and Get<string> deserializes it (unwrapping quotes).
      // Then Check handler does its own JSON.parse on the inner string.
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const handler = new Check(setNx, get, {}, ctx);

      // First: acquire lock (SetNx stores "__processing__" as a JSON-serialized string)
      const result1 = await handler.handleAsync({ idempotencyKey: "double-ser-1" });
      expect(result1.data?.state).toBe("acquired");

      // Verify what's actually in Redis: the sentinel should be stored as JSON '"__processing__"'
      const rawInRedis = await redis.getBuffer("idempotency:double-ser-1");
      expect(rawInRedis).not.toBeNull();
      // The JsonCacheSerializer wraps the string in quotes: "__processing__" → '"__processing__"'
      const rawStr = rawInRedis!.toString("utf-8");
      expect(rawStr).toBe('"__processing__"');

      // Second request: Check handler uses Get<string> which deserializes '"__processing__"' → "__processing__"
      // Then compares with sentinel → returns in_flight
      const result2 = await handler.handleAsync({ idempotencyKey: "double-ser-1" });
      expect(result2.data?.state).toBe("in_flight");
    });

    it("should handle concurrent acquire attempts (second gets in_flight)", async () => {
      const redis = getRedis();
      const ctx = createTestContext();
      const setNx = new SetNx<string>(redis, ctx);
      const get = new Get<string>(redis, ctx);
      const handler = new Check(setNx, get, {}, ctx);

      // Fire two concurrent requests with same key
      const [result1, result2] = await Promise.all([
        handler.handleAsync({ idempotencyKey: "concurrent-1" }),
        handler.handleAsync({ idempotencyKey: "concurrent-1" }),
      ]);

      const states = [result1.data?.state, result2.data?.state].sort();
      // One should acquire, one should be in_flight
      expect(states).toEqual(["acquired", "in_flight"]);
    });
  });
});
