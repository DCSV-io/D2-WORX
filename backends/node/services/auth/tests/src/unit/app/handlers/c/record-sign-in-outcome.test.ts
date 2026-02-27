import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { SIGN_IN_THROTTLE } from "@d2/auth-domain";
import { RecordSignInOutcome, CheckSignInThrottle } from "@d2/auth-app";
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

const INPUT_BASE = { identifierHash: "id-hash-abc", identityHash: "ip-hash-xyz" };

describe("RecordSignInOutcome", () => {
  let store: ReturnType<typeof createMockStore>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    store = createMockStore();
    cache = createMockCache();
  });

  // -----------------------------------------------------------------------
  // Success (200)
  // -----------------------------------------------------------------------

  describe("success outcome (status 200)", () => {
    it("should mark known-good and clear failure state", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 200 });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(true);
      expect(store.markKnownGood).toHaveBeenCalledWith(
        INPUT_BASE.identifierHash,
        INPUT_BASE.identityHash,
      );
      expect(store.clearFailureState).toHaveBeenCalledWith(
        INPUT_BASE.identifierHash,
        INPUT_BASE.identityHash,
      );
    });

    it("should update local cache on success", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext(), cache);

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 200 });

      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
      const setCall = cache.set.handleAsync.mock.calls[0][0];
      expect(setCall.value).toBe(true);
      expect(setCall.expirationMs).toBe(SIGN_IN_THROTTLE.KNOWN_GOOD_CACHE_TTL_MS);
    });

    it("should not increment failures on success", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 200 });

      expect(store.incrementFailures).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Failure (401/400)
  // -----------------------------------------------------------------------

  describe("failure outcome (status 401)", () => {
    it("should increment failures on 401", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(true);
      expect(store.incrementFailures).toHaveBeenCalledWith(
        INPUT_BASE.identifierHash,
        INPUT_BASE.identityHash,
      );
    });

    it("should increment failures on 400", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 400 });

      expect(store.incrementFailures).toHaveBeenCalledOnce();
    });

    it("should NOT set locked when failure count is within free attempts", async () => {
      store.incrementFailures = vi.fn().mockResolvedValue(2); // within FREE_ATTEMPTS (3)
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(store.setLocked).not.toHaveBeenCalled();
    });

    it("should set locked when failure count exceeds free attempts", async () => {
      store.incrementFailures = vi.fn().mockResolvedValue(4); // 4th failure → 5s delay
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(store.setLocked).toHaveBeenCalledWith(
        INPUT_BASE.identifierHash,
        INPUT_BASE.identityHash,
        5, // 5000ms → ceil(5000/1000) = 5 seconds
      );
    });

    it("should set locked with correct delay for high failure count", async () => {
      store.incrementFailures = vi.fn().mockResolvedValue(9); // 9+ → 15m max
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(store.setLocked).toHaveBeenCalledWith(
        INPUT_BASE.identifierHash,
        INPUT_BASE.identityHash,
        900, // 15 min = 900 seconds
      );
    });

    it("should not mark known-good on failure", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(store.markKnownGood).not.toHaveBeenCalled();
      expect(store.clearFailureState).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Other status / errors
  // -----------------------------------------------------------------------

  describe("other status codes", () => {
    it("should no-op for 500 status", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 500 });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(false);
      expect(store.incrementFailures).not.toHaveBeenCalled();
      expect(store.markKnownGood).not.toHaveBeenCalled();
    });

    it("should no-op for 302 redirect status", async () => {
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 302 });

      expect(result.data?.recorded).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should return recorded=false when store throws on success path", async () => {
      store.markKnownGood = vi.fn().mockRejectedValue(new Error("Redis down"));
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 200 });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(false);
    });

    it("should return recorded=false when store throws on failure path", async () => {
      store.incrementFailures = vi.fn().mockRejectedValue(new Error("Redis down"));
      const handler = new RecordSignInOutcome(store, createTestContext());

      const result = await handler.handleAsync({ ...INPUT_BASE, responseStatus: 401 });

      expect(result.success).toBe(true);
      expect(result.data?.recorded).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-handler cache coherence: RecordSignInOutcome → CheckSignInThrottle
// ---------------------------------------------------------------------------

describe("Cross-handler cache coherence: RecordSignInOutcome → CheckSignInThrottle", () => {
  const INPUT = { identifierHash: "email-hash-cross", identityHash: "ip-hash-cross" };

  function createTestContext() {
    const request: IRequestContext = {
      traceId: "trace-cross-handler",
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

  it("known-good state set by RecordSignInOutcome should be readable by CheckSignInThrottle via the same cache key", async () => {
    const store = createMockStore();

    // Use a real-ish cache that records calls and stores values in a Map
    const cacheStore = new Map<string, unknown>();
    const cache = {
      get: {
        handleAsync: vi.fn().mockImplementation(async (input: { key: string }) => {
          const value = cacheStore.get(input.key);
          return D2Result.ok({ data: { value } });
        }),
      },
      set: {
        handleAsync: vi.fn().mockImplementation(async (input: { key: string; value: unknown }) => {
          cacheStore.set(input.key, input.value);
          return D2Result.ok({ data: {} });
        }),
      },
    };

    // Step 1: Record a successful sign-in via RecordSignInOutcome
    const recordHandler = new RecordSignInOutcome(store, createTestContext(), cache);
    await recordHandler.handleAsync({ ...INPUT, responseStatus: 200 });

    // Verify cache was populated with known-good = true
    const expectedKey = `auth:sign-in-throttle:${INPUT.identifierHash}:${INPUT.identityHash}`;
    expect(cacheStore.has(expectedKey)).toBe(true);
    expect(cacheStore.get(expectedKey)).toBe(true);

    // Step 2: Check throttle via CheckSignInThrottle — should find it in cache (fast path)
    const checkHandler = new CheckSignInThrottle(store, createTestContext(), cache);
    const checkResult = await checkHandler.handleAsync(INPUT);

    expect(checkResult.success).toBe(true);
    expect(checkResult.data?.blocked).toBe(false);

    // Store should NOT have been called — cache hit (fast path, 0 Redis calls)
    expect(store.isKnownGood).toHaveBeenCalledTimes(0);
    expect(store.getLockedTtlSeconds).toHaveBeenCalledTimes(0);
  });

  it("both handlers should use the exact same cache key format auth:sign-in-throttle:{identifierHash}:{identityHash}", async () => {
    const store = createMockStore();
    const recordCache = {
      get: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
      },
      set: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
    };
    const checkCache = {
      get: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
      },
      set: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
    };

    // RecordSignInOutcome writes to cache on success
    const recordHandler = new RecordSignInOutcome(store, createTestContext(), recordCache);
    await recordHandler.handleAsync({ ...INPUT, responseStatus: 200 });

    // CheckSignInThrottle reads from cache
    const checkHandler = new CheckSignInThrottle(store, createTestContext(), checkCache);
    await checkHandler.handleAsync(INPUT);

    const recordCacheKey = recordCache.set.handleAsync.mock.calls[0][0].key;
    const checkCacheKey = checkCache.get.handleAsync.mock.calls[0][0].key;

    // Both must produce the exact same key
    expect(recordCacheKey).toBe(
      `auth:sign-in-throttle:${INPUT.identifierHash}:${INPUT.identityHash}`,
    );
    expect(checkCacheKey).toBe(
      `auth:sign-in-throttle:${INPUT.identifierHash}:${INPUT.identityHash}`,
    );
    expect(recordCacheKey).toBe(checkCacheKey);
  });

  it("both handlers should use the same TTL for known-good cache entries", async () => {
    const store = createMockStore();
    store.isKnownGood = vi.fn().mockResolvedValue(true); // for CheckSignInThrottle store path

    const recordCache = {
      get: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
      },
      set: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
    };
    const checkCache = {
      get: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
      },
      set: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
    };

    // RecordSignInOutcome sets cache with KNOWN_GOOD_CACHE_TTL_MS on success
    const recordHandler = new RecordSignInOutcome(store, createTestContext(), recordCache);
    await recordHandler.handleAsync({ ...INPUT, responseStatus: 200 });

    // CheckSignInThrottle sets cache with KNOWN_GOOD_CACHE_TTL_MS when store confirms known-good
    const checkHandler = new CheckSignInThrottle(store, createTestContext(), checkCache);
    await checkHandler.handleAsync(INPUT);

    const recordTtl = recordCache.set.handleAsync.mock.calls[0][0].expirationMs;
    const checkTtl = checkCache.set.handleAsync.mock.calls[0][0].expirationMs;

    expect(recordTtl).toBe(SIGN_IN_THROTTLE.KNOWN_GOOD_CACHE_TTL_MS);
    expect(checkTtl).toBe(SIGN_IN_THROTTLE.KNOWN_GOOD_CACHE_TTL_MS);
    expect(recordTtl).toBe(checkTtl);
  });
});
