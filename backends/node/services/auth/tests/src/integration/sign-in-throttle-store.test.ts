import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import * as CacheRedis from "@d2/cache-redis";
import { SignInThrottleStore } from "@d2/auth-infra";
import { SIGN_IN_THROTTLE } from "@d2/auth-domain";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

/**
 * Tests `SignInThrottleStore` with real @d2/cache-redis handlers
 * against a real Redis instance.
 *
 * Validates Redis key lifecycle, TTL accuracy, INCR atomicity,
 * and key isolation between different identifier+identity pairs.
 */
describe("SignInThrottleStore (integration)", () => {
  let store: SignInThrottleStore;

  beforeAll(async () => {
    await startRedis();
    const ctx = createTestContext();
    const redis = getRedis();

    store = new SignInThrottleStore(
      new CacheRedis.Exists(redis, ctx),
      new CacheRedis.GetTtl(redis, ctx),
      new CacheRedis.Set<string>(redis, ctx),
      new CacheRedis.Remove(redis, ctx),
      new CacheRedis.Increment(redis, ctx),
    );
  }, 120_000);

  afterAll(async () => {
    await stopRedis();
  });

  beforeEach(async () => {
    await flushRedis();
  });

  const ID = "identifier-hash-1";
  const IDENTITY = "identity-hash-1";

  // -----------------------------------------------------------------------
  // Known-good
  // -----------------------------------------------------------------------
  describe("known-good", () => {
    it("should return false when not set", async () => {
      const result = await store.isKnownGood(ID, IDENTITY);
      expect(result).toBe(false);
    });

    it("should return true after markKnownGood", async () => {
      await store.markKnownGood(ID, IDENTITY);
      const result = await store.isKnownGood(ID, IDENTITY);
      expect(result).toBe(true);
    });

    it("should set correct TTL on known-good key", async () => {
      await store.markKnownGood(ID, IDENTITY);

      const redis = getRedis();
      const pttl = await redis.pttl(`signin:known:${ID}:${IDENTITY}`);

      // Expected: ~KNOWN_GOOD_TTL_SECONDS * 1000 ms (90 days = 7776000000 ms)
      const expectedMs = SIGN_IN_THROTTLE.KNOWN_GOOD_TTL_SECONDS * 1000;
      expect(pttl).toBeGreaterThan(expectedMs - 5000);
      expect(pttl).toBeLessThanOrEqual(expectedMs);
    });
  });

  // -----------------------------------------------------------------------
  // Failure tracking
  // -----------------------------------------------------------------------
  describe("failure tracking", () => {
    it("should return 1 on first incrementFailures", async () => {
      const count = await store.incrementFailures(ID, IDENTITY);
      expect(count).toBe(1);
    });

    it("should increment sequentially", async () => {
      expect(await store.incrementFailures(ID, IDENTITY)).toBe(1);
      expect(await store.incrementFailures(ID, IDENTITY)).toBe(2);
      expect(await store.incrementFailures(ID, IDENTITY)).toBe(3);
    });

    it("should set TTL on attempts key", async () => {
      await store.incrementFailures(ID, IDENTITY);

      const redis = getRedis();
      const pttl = await redis.pttl(`signin:attempts:${ID}:${IDENTITY}`);

      const expectedMs = SIGN_IN_THROTTLE.ATTEMPT_WINDOW_SECONDS * 1000;
      expect(pttl).toBeGreaterThan(expectedMs - 5000);
      expect(pttl).toBeLessThanOrEqual(expectedMs);
    });
  });

  // -----------------------------------------------------------------------
  // Lockout
  // -----------------------------------------------------------------------
  describe("lockout", () => {
    it("should return 0 when no lock exists", async () => {
      const ttl = await store.getLockedTtlSeconds(ID, IDENTITY);
      expect(ttl).toBe(0);
    });

    it("should return positive TTL after setLocked", async () => {
      await store.setLocked(ID, IDENTITY, 10);
      const ttl = await store.getLockedTtlSeconds(ID, IDENTITY);

      // Should be close to 10 seconds
      expect(ttl).toBeGreaterThan(8);
      expect(ttl).toBeLessThanOrEqual(10);
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------
  describe("cleanup", () => {
    it("should remove attempts and locked keys", async () => {
      await store.incrementFailures(ID, IDENTITY);
      await store.incrementFailures(ID, IDENTITY);
      await store.setLocked(ID, IDENTITY, 60);

      await store.clearFailureState(ID, IDENTITY);

      // Both keys should be gone
      const redis = getRedis();
      const attemptsExists = await redis.exists(`signin:attempts:${ID}:${IDENTITY}`);
      const lockedExists = await redis.exists(`signin:locked:${ID}:${IDENTITY}`);
      expect(attemptsExists).toBe(0);
      expect(lockedExists).toBe(0);
    });

    it("should reset failure counter after clearFailureState", async () => {
      await store.incrementFailures(ID, IDENTITY);
      await store.incrementFailures(ID, IDENTITY);
      await store.clearFailureState(ID, IDENTITY);

      // Should start fresh at 1
      const count = await store.incrementFailures(ID, IDENTITY);
      expect(count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Isolation
  // -----------------------------------------------------------------------
  describe("isolation", () => {
    it("should not cross-contaminate between different identifier+identity pairs", async () => {
      const idA = "id-a";
      const identityA = "identity-a";
      const idB = "id-b";
      const identityB = "identity-b";

      await store.markKnownGood(idA, identityA);
      await store.incrementFailures(idB, identityB);

      // A is known-good, B is not
      expect(await store.isKnownGood(idA, identityA)).toBe(true);
      expect(await store.isKnownGood(idB, identityB)).toBe(false);

      // B has failures, A does not
      const redis = getRedis();
      const aAttempts = await redis.exists(`signin:attempts:${idA}:${identityA}`);
      const bAttempts = await redis.exists(`signin:attempts:${idB}:${identityB}`);
      expect(aAttempts).toBe(0);
      expect(bAttempts).toBe(1);
    });
  });
});
