import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { CheckSignInThrottle } from "@d2/auth-app";
import type { ISignInThrottleStore } from "@d2/auth-app";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockStore(): ISignInThrottleStore {
  return {
    isKnownGood: vi.fn().mockResolvedValue(false),
    getLockedTtlSeconds: vi.fn().mockResolvedValue(0),
    markKnownGood: vi.fn().mockResolvedValue(undefined),
    incrementFailures: vi.fn().mockResolvedValue(1),
    setLocked: vi.fn().mockResolvedValue(undefined),
    clearFailureState: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCache() {
  return {
    get: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
    },
    set: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    },
  };
}

const INPUT = { identifierHash: "id-hash-abc", identityHash: "ip-hash-xyz" };

describe("CheckSignInThrottle", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
  });

  describe("without cache", () => {
    it("should return blocked=false when not known-good and not locked", async () => {
      const handler = new CheckSignInThrottle(store, createTestContext());

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
    });

    it("should return blocked=false when known-good", async () => {
      store.isKnownGood = vi.fn().mockResolvedValue(true);
      const handler = new CheckSignInThrottle(store, createTestContext());

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
    });

    it("should return blocked=true with retryAfterSec when locked", async () => {
      store.getLockedTtlSeconds = vi.fn().mockResolvedValue(30);
      const handler = new CheckSignInThrottle(store, createTestContext());

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(true);
      expect(result.data?.retryAfterSec).toBe(30);
    });

    it("should fail-open when store throws", async () => {
      store.isKnownGood = vi.fn().mockRejectedValue(new Error("Redis down"));
      const handler = new CheckSignInThrottle(store, createTestContext());

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
    });
  });

  describe("with cache", () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it("should return blocked=false from cache hit without calling store", async () => {
      cache.get.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({ data: { value: true } }));
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
      expect(store.isKnownGood).not.toHaveBeenCalled();
      expect(store.getLockedTtlSeconds).not.toHaveBeenCalled();
    });

    it("should populate cache when store confirms known-good on cache miss", async () => {
      store.isKnownGood = vi.fn().mockResolvedValue(true);
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
      const setCall = cache.set.handleAsync.mock.calls[0][0];
      expect(setCall.value).toBe(true);
      expect(setCall.expirationMs).toBe(5 * 60 * 1000);
    });

    it("should not populate cache when identity is not known-good", async () => {
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      await handler.handleAsync(INPUT);

      expect(cache.set.handleAsync).not.toHaveBeenCalled();
    });

    it("should call store when cache returns undefined value", async () => {
      cache.get.handleAsync = vi
        .fn()
        .mockResolvedValue(D2Result.ok({ data: { value: undefined } }));
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      await handler.handleAsync(INPUT);

      expect(store.isKnownGood).toHaveBeenCalledOnce();
      expect(store.getLockedTtlSeconds).toHaveBeenCalledOnce();
    });

    it("should call isKnownGood and getLockedTtlSeconds concurrently on cache miss", async () => {
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      await handler.handleAsync(INPUT);

      // Both should be called with the correct arguments
      expect(store.isKnownGood).toHaveBeenCalledWith(INPUT.identifierHash, INPUT.identityHash);
      expect(store.getLockedTtlSeconds).toHaveBeenCalledWith(
        INPUT.identifierHash,
        INPUT.identityHash,
      );
    });

    it("should fail-open when cache throws", async () => {
      cache.get.handleAsync = vi.fn().mockRejectedValue(new Error("Cache error"));
      // Store also fails — entire check should fail open
      store.isKnownGood = vi.fn().mockRejectedValue(new Error("Redis down"));
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
    });

    it("should return blocked=false when known-good even if also locked (legit user during attack)", async () => {
      // Both conditions true simultaneously — known-good must win
      store.isKnownGood = vi.fn().mockResolvedValue(true);
      store.getLockedTtlSeconds = vi.fn().mockResolvedValue(900); // 15 min lockout active
      const handler = new CheckSignInThrottle(store, createTestContext(), cache);

      const result = await handler.handleAsync(INPUT);

      expect(result.success).toBe(true);
      expect(result.data?.blocked).toBe(false);
      // Should also populate cache for the known-good identity
      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
    });
  });
});
