import { describe, it, expect, vi } from "vitest";
import {
  D2Result,
  ErrorCodes,
  HttpStatusCode,
  retryResultAsync,
  retryExternalAsync,
  isTransientResult,
} from "@d2/result";

// Helper: create a no-op delay function that records calls
function createMockDelay() {
  const calls: number[] = [];
  const fn = async (ms: number) => {
    calls.push(ms);
  };
  return { fn, calls };
}

// ---------------------------------------------------------------------------
// isTransientResult
// ---------------------------------------------------------------------------

describe("isTransientResult", () => {
  it("returns false for successful results", () => {
    expect(isTransientResult(D2Result.ok())).toBe(false);
  });

  it("returns true for SERVICE_UNAVAILABLE", () => {
    expect(
      isTransientResult(
        D2Result.fail({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        }),
      ),
    ).toBe(true);
  });

  it("returns true for UNHANDLED_EXCEPTION", () => {
    expect(isTransientResult(D2Result.unhandledException())).toBe(true);
  });

  it("returns true for RATE_LIMITED", () => {
    expect(
      isTransientResult(
        D2Result.fail({
          errorCode: ErrorCodes.RATE_LIMITED,
          statusCode: HttpStatusCode.TooManyRequests,
        }),
      ),
    ).toBe(true);
  });

  it("returns true for CONFLICT", () => {
    expect(isTransientResult(D2Result.conflict())).toBe(true);
  });

  it("returns true for 5xx without error code", () => {
    expect(
      isTransientResult(D2Result.fail({ statusCode: HttpStatusCode.InternalServerError })),
    ).toBe(true);
  });

  it("returns true for 429 without error code", () => {
    expect(isTransientResult(D2Result.fail({ statusCode: HttpStatusCode.TooManyRequests }))).toBe(
      true,
    );
  });

  it("returns false for NOT_FOUND", () => {
    expect(isTransientResult(D2Result.notFound())).toBe(false);
  });

  it("returns false for UNAUTHORIZED", () => {
    expect(isTransientResult(D2Result.unauthorized())).toBe(false);
  });

  it("returns false for FORBIDDEN", () => {
    expect(isTransientResult(D2Result.forbidden())).toBe(false);
  });

  it("returns false for VALIDATION_FAILED", () => {
    expect(isTransientResult(D2Result.validationFailed())).toBe(false);
  });

  it("returns false for SOME_FOUND", () => {
    expect(isTransientResult(D2Result.someFound())).toBe(false);
  });

  it("returns false for COULD_NOT_BE_SERIALIZED", () => {
    expect(
      isTransientResult(D2Result.fail({ errorCode: ErrorCodes.COULD_NOT_BE_SERIALIZED })),
    ).toBe(false);
  });

  it("returns false for COULD_NOT_BE_DESERIALIZED", () => {
    expect(
      isTransientResult(D2Result.fail({ errorCode: ErrorCodes.COULD_NOT_BE_DESERIALIZED })),
    ).toBe(false);
  });

  it("errorCode takes precedence over statusCode (NOT_FOUND + 500 → not transient)", () => {
    expect(
      isTransientResult(
        D2Result.fail({
          errorCode: ErrorCodes.NOT_FOUND,
          statusCode: HttpStatusCode.InternalServerError,
        }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryResultAsync (clean)
// ---------------------------------------------------------------------------

describe("retryResultAsync", () => {
  it("returns immediately on successful result", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.ok({ data: 42 }));

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
    expect(result).toHaveData(42);
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("retries SERVICE_UNAVAILABLE and succeeds", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(
        D2Result.fail({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        }),
      )
      .mockResolvedValueOnce(D2Result.ok({ data: "ok" }));

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
    expect(result).toHaveData("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries UNHANDLED_EXCEPTION and succeeds", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(D2Result.unhandledException())
      .mockResolvedValueOnce(D2Result.ok());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("retries RATE_LIMITED and succeeds", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(
        D2Result.fail({
          errorCode: ErrorCodes.RATE_LIMITED,
          statusCode: HttpStatusCode.TooManyRequests,
        }),
      )
      .mockResolvedValueOnce(D2Result.ok());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
  });

  it("retries CONFLICT and succeeds", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(D2Result.conflict())
      .mockResolvedValueOnce(D2Result.ok());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
  });

  it("retries on 5xx status code without error code", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(D2Result.fail({ statusCode: HttpStatusCode.InternalServerError }))
      .mockResolvedValueOnce(D2Result.ok());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeSuccess();
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry NOT_FOUND", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.notFound());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.NOT_FOUND);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry UNAUTHORIZED", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.unauthorized());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry FORBIDDEN", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.forbidden());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry VALIDATION_FAILED", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.validationFailed());

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("SOME_FOUND is not retried", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.someFound({ data: [1, 2] }));

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.SOME_FOUND);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("returns last failed result after exhaustion", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce(D2Result.unhandledException({ messages: ["attempt 1"] }))
      .mockResolvedValueOnce(D2Result.unhandledException({ messages: ["attempt 2"] }))
      .mockResolvedValueOnce(D2Result.unhandledException({ messages: ["attempt 3"] }));

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(result).toHaveMessages(["attempt 3"]);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("custom isTransientResult overrides default", async () => {
    const delay = createMockDelay();
    // NOT_FOUND is normally NOT transient, but we override
    const op = vi
      .fn()
      .mockResolvedValueOnce(D2Result.notFound())
      .mockResolvedValueOnce(D2Result.ok({ data: "found" }));

    const result = await retryResultAsync(op, {
      maxAttempts: 3,
      isTransientResult: (r) => r.errorCode === ErrorCodes.NOT_FOUND,
      _delayFn: delay.fn,
    });

    expect(result).toBeSuccess();
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("operation that throws is caught and returns unhandledException D2Result", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("kaboom"))
      .mockResolvedValueOnce(D2Result.ok({ data: "ok" }));

    const result = await retryResultAsync(op, { maxAttempts: 3, _delayFn: delay.fn });

    // unhandledException is transient, so it retries
    expect(result).toBeSuccess();
    expect(result).toHaveData("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("passes 1-based attempt number to operation", async () => {
    const delay = createMockDelay();
    const attempts: number[] = [];
    const op = vi.fn().mockImplementation(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) return D2Result.unhandledException();
      return D2Result.ok();
    });

    await retryResultAsync(op, { maxAttempts: 5, _delayFn: delay.fn });

    expect(attempts).toEqual([1, 2, 3]);
  });

  it("maxAttempts=1 returns transient failure without retrying", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.unhandledException());

    const result = await retryResultAsync(op, { maxAttempts: 1, _delayFn: delay.fn });

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.UNHANDLED_EXCEPTION);
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("signal abort stops retry loop", async () => {
    const controller = new AbortController();
    controller.abort();
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue(D2Result.unhandledException());

    const result = await retryResultAsync(op, {
      maxAttempts: 5,
      signal: controller.signal,
      _delayFn: delay.fn,
    });

    // Pre-aborted signal: returns initial lastResult without calling operation
    expect(result).toBeFailure();
    expect(op).toHaveBeenCalledTimes(0);
  });
});

// ---------------------------------------------------------------------------
// retryExternalAsync (dirty)
// ---------------------------------------------------------------------------

describe("retryExternalAsync", () => {
  it("maps raw response to D2Result via mapResult, returns on success", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue({ status: 200, body: "data" });

    const result = await retryExternalAsync(
      op,
      (raw) => D2Result.ok({ data: (raw as { body: string }).body }),
      { maxAttempts: 3, _delayFn: delay.fn },
    );

    expect(result).toBeSuccess();
    expect(result).toHaveData("data");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("maps raw response to transient D2Result and retries", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200, body: "ok" });

    const result = await retryExternalAsync(
      op,
      (raw) => {
        const r = raw as { status: number; body?: string };
        if (r.status === 200) return D2Result.ok({ data: r.body });
        return D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        });
      },
      { maxAttempts: 3, _delayFn: delay.fn },
    );

    expect(result).toBeSuccess();
    expect(result).toHaveData("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("maps raw response to permanent D2Result and returns immediately", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue({ status: 404 });

    const result = await retryExternalAsync(op, () => D2Result.notFound<string>(), {
      maxAttempts: 3,
      _delayFn: delay.fn,
    });

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.NOT_FOUND);
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("exception with default mapError produces unhandledException (transient, retries)", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce({ status: 200, body: "ok" });

    const result = await retryExternalAsync(
      op,
      (raw) => D2Result.ok({ data: (raw as { body: string }).body }),
      { maxAttempts: 3, _delayFn: delay.fn },
    );

    expect(result).toBeSuccess();
    expect(result).toHaveData("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("exception with custom mapError producing NOT_FOUND does not retry", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockRejectedValue(new Error("not found upstream"));

    const result = await retryExternalAsync(op, () => D2Result.ok<string>(), {
      maxAttempts: 3,
      mapError: () => D2Result.notFound(),
      _delayFn: delay.fn,
    });

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.NOT_FOUND);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("returns last D2Result after exhaustion", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue({ status: 503 });

    const result = await retryExternalAsync(
      op,
      () =>
        D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
          messages: ["still down"],
        }),
      { maxAttempts: 3, _delayFn: delay.fn },
    );

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(result).toHaveMessages(["still down"]);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("backoff timing with jitter=false", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200, body: "ok" });

    await retryExternalAsync(
      op,
      (raw) => {
        const r = raw as { status: number; body?: string };
        if (r.status === 200) return D2Result.ok({ data: r.body });
        return D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        });
      },
      {
        maxAttempts: 5,
        baseDelayMs: 100,
        backoffMultiplier: 2,
        jitter: false,
        _delayFn: delay.fn,
      },
    );

    // Retry 0: 100 * 2^0 = 100
    // Retry 1: 100 * 2^1 = 200
    expect(delay.calls[0]).toBe(100);
    expect(delay.calls[1]).toBe(200);
  });

  it("passes 1-based attempt number to operation", async () => {
    const delay = createMockDelay();
    const attempts: number[] = [];
    const op = vi.fn().mockImplementation(async (attempt: number) => {
      attempts.push(attempt);
      if (attempt < 3) return { status: 503 };
      return { status: 200 };
    });

    await retryExternalAsync(
      op,
      (raw) => {
        const r = raw as { status: number };
        if (r.status === 200) return D2Result.ok<string>();
        return D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        });
      },
      { maxAttempts: 5, _delayFn: delay.fn },
    );

    expect(attempts).toEqual([1, 2, 3]);
  });

  it("maxAttempts=1 returns transient failure without retrying", async () => {
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue({ status: 503 });

    const result = await retryExternalAsync(
      op,
      () =>
        D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        }),
      { maxAttempts: 1, _delayFn: delay.fn },
    );

    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(op).toHaveBeenCalledTimes(1);
    expect(delay.calls).toHaveLength(0);
  });

  it("signal abort stops retry loop", async () => {
    const controller = new AbortController();
    controller.abort();
    const delay = createMockDelay();
    const op = vi.fn().mockResolvedValue({ status: 503 });

    const result = await retryExternalAsync(
      op,
      () =>
        D2Result.fail<string>({
          errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
          statusCode: HttpStatusCode.ServiceUnavailable,
        }),
      { maxAttempts: 5, signal: controller.signal, _delayFn: delay.fn },
    );

    // Pre-aborted signal: returns initial lastResult without calling operation
    expect(result).toBeFailure();
    expect(op).toHaveBeenCalledTimes(0);
  });

  it("mapResult throwing is caught as unhandledException", async () => {
    const delay = createMockDelay();
    const op = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, body: "data" })
      .mockResolvedValueOnce({ status: 200, body: "data" });

    const result = await retryExternalAsync(
      op,
      () => {
        throw new Error("mapResult failed");
      },
      { maxAttempts: 2, _delayFn: delay.fn },
    );

    // mapResult throws → caught as unhandledException (transient) → retries → exhausts
    expect(result).toBeFailure();
    expect(result).toHaveErrorCode(ErrorCodes.UNHANDLED_EXCEPTION);
    expect(op).toHaveBeenCalledTimes(2);
  });
});
