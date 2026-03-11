import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
} from "@d2/utilities";

describe("CircuitBreaker", () => {
  let now: number;
  const nowFn = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  function createBreaker(overrides?: Partial<Parameters<typeof CircuitBreaker.prototype.execute>[0]> & {
    failureThreshold?: number;
    cooldownMs?: number;
    isFailure?: (r: unknown) => boolean;
    isFailureError?: (e: unknown) => boolean;
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
  }) {
    return new CircuitBreaker({ _nowFn: nowFn, ...overrides });
  }

  // --- Initial state ---

  it("starts in CLOSED state with zero failures", () => {
    const breaker = createBreaker();
    expect(breaker.state).toBe(CircuitState.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  // --- CLOSED state ---

  it("executes operation normally when CLOSED", async () => {
    const breaker = createBreaker();
    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("resets failure count on success", async () => {
    const breaker = createBreaker({ failureThreshold: 5 });

    // 3 failures
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail")), () => "fb").catch(() => {});
    }
    expect(breaker.failureCount).toBe(3);

    // 1 success resets
    await breaker.execute(() => Promise.resolve("ok"));
    expect(breaker.failureCount).toBe(0);
  });

  it("tracks consecutive thrown-error failures", async () => {
    const breaker = createBreaker({ failureThreshold: 5 });

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail");
    }

    expect(breaker.failureCount).toBe(3);
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("tracks result-based failures via isFailure predicate", async () => {
    const breaker = createBreaker({
      failureThreshold: 3,
      isFailure: (r) => r === "bad",
    });

    await breaker.execute(() => Promise.resolve("bad"));
    await breaker.execute(() => Promise.resolve("bad"));
    expect(breaker.failureCount).toBe(2);
    expect(breaker.state).toBe(CircuitState.CLOSED);

    await breaker.execute(() => Promise.resolve("bad"));
    expect(breaker.state).toBe(CircuitState.OPEN);
  });

  it("opens after failureThreshold consecutive failures", async () => {
    const breaker = createBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    }

    expect(breaker.state).toBe(CircuitState.OPEN);
  });

  it("does not count errors that isFailureError rejects", async () => {
    const breaker = createBreaker({
      failureThreshold: 2,
      isFailureError: (e) => !(e instanceof TypeError),
    });

    // TypeError doesn't count
    await expect(breaker.execute(() => Promise.reject(new TypeError("nope")))).rejects.toThrow(TypeError);
    expect(breaker.failureCount).toBe(0);

    // Regular error counts
    await expect(breaker.execute(() => Promise.reject(new Error("real")))).rejects.toThrow();
    expect(breaker.failureCount).toBe(1);
  });

  // --- OPEN state ---

  it("calls fallback immediately when OPEN", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.state).toBe(CircuitState.OPEN);

    const op = vi.fn();
    const result = await breaker.execute(op, () => "fallback");
    expect(result).toBe("fallback");
    expect(op).not.toHaveBeenCalled();
  });

  it("throws CircuitOpenError when OPEN and no fallback", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    await expect(breaker.execute(() => Promise.resolve("nope"))).rejects.toThrow(CircuitOpenError);
  });

  it("does not execute the operation when OPEN", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    const op = vi.fn().mockResolvedValue("ok");
    await breaker.execute(op, () => "fb");
    expect(op).not.toHaveBeenCalled();
  });

  // --- OPEN → HALF_OPEN transition ---

  it("transitions to HALF_OPEN after cooldown elapses", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 5000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.state).toBe(CircuitState.OPEN);

    // Advance time past cooldown
    now += 5000;

    // Next call triggers transition + acts as probe
    const result = await breaker.execute(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("stays OPEN if cooldown has not elapsed", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 5000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    now += 4999; // Not enough
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow(CircuitOpenError);
    expect(breaker.state).toBe(CircuitState.OPEN);
  });

  // --- HALF_OPEN state ---

  it("successful probe transitions to CLOSED", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    now += 1000;

    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.state).toBe(CircuitState.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  it("failed probe transitions back to OPEN", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    now += 1000;

    await expect(breaker.execute(() => Promise.reject(new Error("still down")))).rejects.toThrow("still down");
    expect(breaker.state).toBe(CircuitState.OPEN);
  });

  it("additional callers during probe get fallback", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    now += 1000;

    // Start a slow probe that doesn't resolve yet
    let resolveProbe!: (v: string) => void;
    const probePromise = breaker.execute(
      () => new Promise<string>((r) => { resolveProbe = r; }),
    );

    // Second caller while probe is in-flight
    const result = await breaker.execute(
      () => Promise.resolve("should not run"),
      () => "queued-fallback",
    );
    expect(result).toBe("queued-fallback");

    // Complete the probe
    resolveProbe("probe-ok");
    await probePromise;
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  // --- reset() ---

  it("reset() forces CLOSED from OPEN", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.state).toBe(CircuitState.OPEN);

    breaker.reset();
    expect(breaker.state).toBe(CircuitState.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  it("reset() from CLOSED is a no-op", () => {
    const breaker = createBreaker();
    breaker.reset();
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  // --- onStateChange callback ---

  it("fires onStateChange on transitions", async () => {
    const changes: [CircuitState, CircuitState][] = [];
    const breaker = createBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      onStateChange: (from, to) => changes.push([from, to]),
    });

    // CLOSED → OPEN
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(changes).toEqual([[CircuitState.CLOSED, CircuitState.OPEN]]);

    // OPEN → HALF_OPEN → CLOSED
    now += 1000;
    await breaker.execute(() => Promise.resolve("ok"));
    expect(changes).toEqual([
      [CircuitState.CLOSED, CircuitState.OPEN],
      [CircuitState.OPEN, CircuitState.HALF_OPEN],
      [CircuitState.HALF_OPEN, CircuitState.CLOSED],
    ]);
  });

  // --- Edge cases ---

  it("threshold of 1 opens on first failure", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("boom")))).rejects.toThrow();
    expect(breaker.state).toBe(CircuitState.OPEN);
  });

  it("cooldown of 0 transitions to HALF_OPEN immediately", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 0 });
    await expect(breaker.execute(() => Promise.reject(new Error("boom")))).rejects.toThrow();

    const result = await breaker.execute(() => Promise.resolve("instant-recovery"));
    expect(result).toBe("instant-recovery");
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("alternating success/failure keeps circuit closed", async () => {
    const breaker = createBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
      } else {
        await breaker.execute(() => Promise.resolve("ok"));
      }
    }

    // Never reaches 3 consecutive failures
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("failed probe resets cooldown timer", async () => {
    const breaker = createBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    now += 1000; // Cooldown elapsed
    // Probe fails → back to OPEN with new timer
    await expect(breaker.execute(() => Promise.reject(new Error("still down")))).rejects.toThrow();
    expect(breaker.state).toBe(CircuitState.OPEN);

    // Not enough time from the NEW open timestamp
    now += 500;
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow(CircuitOpenError);

    // Full cooldown from the new timestamp
    now += 500;
    const result = await breaker.execute(() => Promise.resolve("finally"));
    expect(result).toBe("finally");
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("async fallback is awaited", async () => {
    const breaker = createBreaker({ failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    const result = await breaker.execute(
      () => Promise.resolve("nope"),
      () => Promise.resolve("async-fallback"),
    );
    expect(result).toBe("async-fallback");
  });

  it("result-based failure in HALF_OPEN probe transitions to OPEN", async () => {
    const breaker = createBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      isFailure: (r) => r === "bad",
    });

    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    now += 1000;

    // Probe returns a "failed" result
    const result = await breaker.execute(() => Promise.resolve("bad"));
    expect(result).toBe("bad");
    expect(breaker.state).toBe(CircuitState.OPEN);
  });
});
