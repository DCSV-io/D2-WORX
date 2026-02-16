import { describe, it, expect, vi, beforeEach } from "vitest";
import { D2Result } from "@d2/result";
import { SIGN_IN_THROTTLE } from "@d2/auth-domain";
import { SignInThrottleStore } from "@d2/auth-infra";

/** Key prefixes are an infra concern — tests verify the actual keys produced. */
const PREFIX_KNOWN = "signin:known:";
const PREFIX_ATTEMPTS = "signin:attempts:";
const PREFIX_LOCKED = "signin:locked:";

function createMockHandler<TOutput>(data: TOutput) {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data })),
  };
}

describe("SignInThrottleStore", () => {
  const idHash = "abc123";
  const ipHash = "xyz789";

  let exists: ReturnType<typeof createMockHandler<{ exists: boolean }>>;
  let getTtl: ReturnType<typeof createMockHandler<{ timeToLiveMs: number | undefined }>>;
  let set: ReturnType<typeof createMockHandler<Record<string, never>>>;
  let remove: ReturnType<typeof createMockHandler<Record<string, never>>>;
  let increment: ReturnType<typeof createMockHandler<{ newValue: number }>>;
  let store: SignInThrottleStore;

  beforeEach(() => {
    exists = createMockHandler({ exists: false });
    getTtl = createMockHandler({ timeToLiveMs: undefined });
    set = createMockHandler({} as Record<string, never>);
    remove = createMockHandler({} as Record<string, never>);
    increment = createMockHandler({ newValue: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store = new SignInThrottleStore(exists as any, getTtl as any, set as any, remove as any, increment as any);
  });

  // -----------------------------------------------------------------------
  // isKnownGood
  // -----------------------------------------------------------------------

  describe("isKnownGood", () => {
    it("should return true when key exists", async () => {
      exists = createMockHandler({ exists: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store = new SignInThrottleStore(exists as any, getTtl as any, set as any, remove as any, increment as any);

      const result = await store.isKnownGood(idHash, ipHash);

      expect(result).toBe(true);
      expect(exists.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_KNOWN}${idHash}:${ipHash}`,
      });
    });

    it("should return false when key does not exist", async () => {
      const result = await store.isKnownGood(idHash, ipHash);

      expect(result).toBe(false);
    });

    it("should return false when handler returns failure", async () => {
      exists.handleAsync = vi.fn().mockResolvedValue(D2Result.fail({ messages: ["error"] }));

      const result = await store.isKnownGood(idHash, ipHash);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getLockedTtlSeconds
  // -----------------------------------------------------------------------

  describe("getLockedTtlSeconds", () => {
    it("should return TTL in seconds when key exists", async () => {
      getTtl = createMockHandler({ timeToLiveMs: 30_000 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store = new SignInThrottleStore(exists as any, getTtl as any, set as any, remove as any, increment as any);

      const result = await store.getLockedTtlSeconds(idHash, ipHash);

      expect(result).toBe(30);
      expect(getTtl.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_LOCKED}${idHash}:${ipHash}`,
      });
    });

    it("should return 0 when key has no TTL", async () => {
      const result = await store.getLockedTtlSeconds(idHash, ipHash);

      expect(result).toBe(0);
    });

    it("should return 0 when handler returns failure", async () => {
      getTtl.handleAsync = vi.fn().mockResolvedValue(D2Result.fail({ messages: ["error"] }));

      const result = await store.getLockedTtlSeconds(idHash, ipHash);

      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // markKnownGood
  // -----------------------------------------------------------------------

  describe("markKnownGood", () => {
    it("should set known-good key with 90-day TTL", async () => {
      await store.markKnownGood(idHash, ipHash);

      expect(set.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_KNOWN}${idHash}:${ipHash}`,
        value: "1",
        expirationMs: SIGN_IN_THROTTLE.KNOWN_GOOD_TTL_SECONDS * 1000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // incrementFailures
  // -----------------------------------------------------------------------

  describe("incrementFailures", () => {
    it("should increment with attempt window TTL and return new value", async () => {
      increment = createMockHandler({ newValue: 3 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store = new SignInThrottleStore(exists as any, getTtl as any, set as any, remove as any, increment as any);

      const result = await store.incrementFailures(idHash, ipHash);

      expect(result).toBe(3);
      expect(increment.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_ATTEMPTS}${idHash}:${ipHash}`,
        amount: 1,
        expirationMs: SIGN_IN_THROTTLE.ATTEMPT_WINDOW_SECONDS * 1000,
      });
    });

    it("should return 1 when handler fails", async () => {
      increment.handleAsync = vi.fn().mockResolvedValue(D2Result.fail({ messages: ["error"] }));

      const result = await store.incrementFailures(idHash, ipHash);

      expect(result).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // setLocked
  // -----------------------------------------------------------------------

  describe("setLocked", () => {
    it("should set locked key with delay TTL", async () => {
      await store.setLocked(idHash, ipHash, 30);

      expect(set.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_LOCKED}${idHash}:${ipHash}`,
        value: "",
        expirationMs: 30_000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // clearFailureState
  // -----------------------------------------------------------------------

  describe("clearFailureState", () => {
    it("should remove both attempts and locked keys", async () => {
      await store.clearFailureState(idHash, ipHash);

      expect(remove.handleAsync).toHaveBeenCalledTimes(2);
      expect(remove.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_ATTEMPTS}${idHash}:${ipHash}`,
      });
      expect(remove.handleAsync).toHaveBeenCalledWith({
        key: `${PREFIX_LOCKED}${idHash}:${ipHash}`,
      });
    });
  });
});
