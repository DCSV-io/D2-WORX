import { describe, it, expect, vi } from "vitest";
import { retryAsync, isTransientError } from "@d2/utilities";

// Helper: create a no-op delay function that records calls
function createMockDelay() {
  const calls: number[] = [];
  const fn = async (ms: number) => {
    calls.push(ms);
  };
  return { fn, calls };
}

// ---------------------------------------------------------------------------
// isTransientError
// ---------------------------------------------------------------------------

describe("isTransientError", () => {
  it("returns true for gRPC UNAVAILABLE (code 14)", () => {
    expect(isTransientError({ code: 14, details: "unavailable" })).toBe(true);
  });

  it("returns true for gRPC DEADLINE_EXCEEDED (code 4)", () => {
    expect(isTransientError({ code: 4 })).toBe(true);
  });

  it("returns true for gRPC RESOURCE_EXHAUSTED (code 8)", () => {
    expect(isTransientError({ code: 8 })).toBe(true);
  });

  it("returns true for gRPC ABORTED (code 10)", () => {
    expect(isTransientError({ code: 10 })).toBe(true);
  });

  it("returns true for gRPC INTERNAL (code 13)", () => {
    expect(isTransientError({ code: 13 })).toBe(true);
  });

  it("returns false for gRPC NOT_FOUND (code 5)", () => {
    expect(isTransientError({ code: 5 })).toBe(false);
  });

  it("returns true for ECONNREFUSED", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:50051");
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for ETIMEDOUT", () => {
    const err = Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" });
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for timeout in message", () => {
    expect(isTransientError(new Error("Operation timeout after 5000ms"))).toBe(true);
  });

  it("returns true for ECONNRESET", () => {
    expect(isTransientError(new Error("socket hang up ECONNRESET"))).toBe(true);
  });

  it("returns true for ENETUNREACH", () => {
    expect(isTransientError(new Error("connect ENETUNREACH"))).toBe(true);
  });

  it("returns true for deadline in message", () => {
    expect(isTransientError(new Error("Deadline exceeded"))).toBe(true);
  });

  it("returns false for AbortError", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    expect(isTransientError(err)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });

  it("returns false for a regular Error", () => {
    expect(isTransientError(new Error("some validation error"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryAsync — exception handling
// ---------------------------------------------------------------------------

describe("retryAsync — exception handling", () => {
  it("succeeds on first attempt with no retries needed", async () => {
    const op = vi.fn().mockResolvedValue("ok");

    const result = await retryAsync(op, { maxAttempts: 3 });

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
    expect(op).toHaveBeenCalledWith(1);
  });

  it("retries on transient thrown error and succeeds on 3rd attempt", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce({ code: 14, details: "unavailable" })
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce("ok");

    const result = await retryAsync(op, { maxAttempts: 5, _delayFn: delay.fn });

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(3);
    expect(delay.calls).toHaveLength(2);
  });

  it("does NOT retry on permanent thrown error", async () => {
    const delay = createMockDelay();
    const permanentError = new Error("INVALID_ARGUMENT");
    const op = vi.fn().mockRejectedValue(permanentError);

    await expect(retryAsync(op, { maxAttempts: 3, _delayFn: delay.fn })).rejects.toThrow(
      "INVALID_ARGUMENT",
    );
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("exhausts all attempts on transient errors and throws last error", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("final ECONNREFUSED"));

    await expect(retryAsync(op, { maxAttempts: 3, _delayFn: delay.fn })).rejects.toThrow(
      "final ECONNREFUSED",
    );
    expect(op).toHaveBeenCalledTimes(3);
    expect(delay.calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// retryAsync — return value inspection
// ---------------------------------------------------------------------------

describe("retryAsync — return value inspection", () => {
  it("retries when shouldRetry returns true, succeeds on 3rd attempt", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce({ status: "retry" })
      .mockResolvedValueOnce({ status: "retry" })
      .mockResolvedValueOnce({ status: "done" });

    const result = await retryAsync(op, {
      maxAttempts: 5,
      shouldRetry: (r) => (r as { status: string }).status === "retry",
      _delayFn: delay.fn,
    });

    expect(result).toEqual({ status: "done" });
    expect(op).toHaveBeenCalledTimes(3);
    expect(delay.calls).toHaveLength(2);
  });

  it("returns immediately when shouldRetry returns false", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue("good");

    const result = await retryAsync(op, {
      maxAttempts: 5,
      shouldRetry: () => false,
      _delayFn: delay.fn,
    });

    expect(result).toBe("good");
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("returns last bad result after all attempts exhausted", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce("bad-1")
      .mockResolvedValueOnce("bad-2")
      .mockResolvedValueOnce("bad-3");

    const result = await retryAsync(op, {
      maxAttempts: 3,
      shouldRetry: () => true,
      _delayFn: delay.fn,
    });

    expect(result).toBe("bad-3");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("without shouldRetry, any return value is accepted", async () => {
    const op = vi.fn().mockResolvedValue(null);

    const result = await retryAsync(op);

    expect(result).toBeNull();
    expect(op).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// retryAsync — mixed scenarios
// ---------------------------------------------------------------------------

describe("retryAsync — mixed scenarios", () => {
  it("handles throw on attempt 1, bad return on attempt 2, success on attempt 3", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValueOnce("retry-me")
      .mockResolvedValueOnce("done");

    const result = await retryAsync(op, {
      maxAttempts: 5,
      shouldRetry: (r) => r === "retry-me",
      _delayFn: delay.fn,
    });

    expect(result).toBe("done");
    expect(op).toHaveBeenCalledTimes(3);
    expect(delay.calls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// retryAsync — configuration
// ---------------------------------------------------------------------------

describe("retryAsync — configuration", () => {
  it("respects maxAttempts", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(retryAsync(op, { maxAttempts: 2, _delayFn: delay.fn })).rejects.toThrow();
    expect(op).toHaveBeenCalledTimes(2);
    expect(delay.calls).toHaveLength(1);
  });

  it("jitter produces delay in [0, calculated) range", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")).mockResolvedValueOnce("ok");

    await retryAsync(op, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      jitter: true,
      _delayFn: delay.fn,
    });

    // First retry: calculated = min(1000 * 2^0, 30000) = 1000
    // With jitter: [0, 1000)
    expect(delay.calls[0]).toBeGreaterThanOrEqual(0);
    expect(delay.calls[0]).toBeLessThan(1000);
  });

  it("jitter=false produces exact calculated delay", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce("ok");

    await retryAsync(op, {
      maxAttempts: 5,
      baseDelayMs: 100,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
      jitter: false,
      _delayFn: delay.fn,
    });

    // Retry 0: 100 * 2^0 = 100
    // Retry 1: 100 * 2^1 = 200
    expect(delay.calls[0]).toBe(100);
    expect(delay.calls[1]).toBe(200);
  });

  it("respects maxDelayMs cap", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce("ok");

    await retryAsync(op, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      backoffMultiplier: 10,
      maxDelayMs: 5000,
      jitter: false,
      _delayFn: delay.fn,
    });

    // Retry 0: min(1000*10^0, 5000) = 1000
    // Retry 1: min(1000*10^1, 5000) = 5000
    // Retry 2: min(1000*10^2, 5000) = 5000
    // Retry 3: min(1000*10^3, 5000) = 5000
    expect(delay.calls[0]).toBe(1000);
    expect(delay.calls[1]).toBe(5000);
    expect(delay.calls[2]).toBe(5000);
    expect(delay.calls[3]).toBe(5000);
  });

  it("custom isTransientError predicate controls exception retry behavior", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("custom-transient"))
      .mockResolvedValueOnce("ok");

    const result = await retryAsync(op, {
      maxAttempts: 3,
      isTransientError: (err) => err instanceof Error && err.message === "custom-transient",
      _delayFn: delay.fn,
    });

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("passes 1-based attempt number to operation", async () => {
    const delay = createMockDelay();
    const attempts: number[] = [];
    const op = vi.fn().mockImplementation(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) throw new Error("ECONNREFUSED");
      return "ok";
    });

    await retryAsync(op, { maxAttempts: 5, _delayFn: delay.fn });

    expect(attempts).toEqual([1, 2, 3]);
  });

  it("AbortSignal cancellation stops retry loop", async () => {
    const controller = new AbortController();
    const delay = createMockDelay();
    const op = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("ECONNREFUSED");
    });

    await expect(
      retryAsync(op, { maxAttempts: 5, signal: controller.signal, _delayFn: delay.fn }),
    ).rejects.toThrow();
    // Should have attempted once, then the abort prevents further retries
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("maxAttempts=1 runs single attempt with no retries", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(retryAsync(op, { maxAttempts: 1, _delayFn: delay.fn })).rejects.toThrow(
      "ECONNREFUSED",
    );
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("pre-aborted signal throws before first attempt", async () => {
    const controller = new AbortController();
    controller.abort();
    const op = vi.fn().mockResolvedValue("ok");

    await expect(retryAsync(op, { maxAttempts: 3, signal: controller.signal })).rejects.toThrow();
    expect(op).toHaveBeenCalledTimes(0);
  });

  it("works with default options (no options passed)", async () => {
    const op = vi.fn().mockResolvedValue("default-result");

    const result = await retryAsync(op);

    expect(result).toBe("default-result");
    expect(op).toHaveBeenCalledTimes(1);
  });
});
