import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { SIGN_IN_THROTTLE } from "@d2/auth-domain";
import { RecordSignInOutcome } from "@d2/auth-app";
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
