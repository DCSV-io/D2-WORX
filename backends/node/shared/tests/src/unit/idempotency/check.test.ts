import { describe, it, expect, vi, beforeEach } from "vitest";
import { Check } from "@d2/idempotency";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, ErrorCodes } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";

function createTestContext(traceId?: string): IHandlerContext {
  const request: IRequestContext = {
    traceId: traceId ?? "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

interface MockHandlers {
  setNx: DistributedCache.ISetNxHandler<string>;
  get: DistributedCache.IGetHandler<string>;
  setNxFn: ReturnType<typeof vi.fn>;
  getFn: ReturnType<typeof vi.fn>;
}

function createMockHandlers(): MockHandlers {
  const setNxFn = vi.fn().mockResolvedValue(
    D2Result.ok<DistributedCache.SetNxOutput | undefined>({
      data: { wasSet: true },
    }),
  );
  const getFn = vi.fn().mockResolvedValue(
    D2Result.ok<DistributedCache.GetOutput<string> | undefined>({
      data: { value: null },
    }),
  );

  return {
    setNx: { handleAsync: setNxFn } as unknown as DistributedCache.ISetNxHandler<string>,
    get: { handleAsync: getFn } as unknown as DistributedCache.IGetHandler<string>,
    setNxFn,
    getFn,
  };
}

function createCheck(mocks: MockHandlers, options?: Record<string, unknown>): Check {
  return new Check(mocks.setNx, mocks.get, options ?? {}, createTestContext());
}

describe("Idempotency Check handler", () => {
  let mocks: MockHandlers;

  beforeEach(() => {
    mocks = createMockHandlers();
  });

  describe("Acquired state", () => {
    it("should return acquired when SET NX succeeds", async () => {
      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
      expect(result.data?.cachedResponse).toBeUndefined();
    });

    it("should use correct cache key prefix", async () => {
      const handler = createCheck(mocks);
      await handler.handleAsync({ idempotencyKey: "my-key-123" });

      expect(mocks.setNxFn).toHaveBeenCalledWith(
        expect.objectContaining({ key: "idempotency:my-key-123" }),
      );
    });

    it("should use inFlightTtl from options", async () => {
      const handler = createCheck(mocks, { inFlightTtlMs: 5000 });
      await handler.handleAsync({ idempotencyKey: "key" });

      expect(mocks.setNxFn).toHaveBeenCalledWith(expect.objectContaining({ expirationMs: 5000 }));
    });
  });

  describe("InFlight state", () => {
    it("should return in_flight when sentinel exists", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: "__processing__" } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("in_flight");
      expect(result.data?.cachedResponse).toBeUndefined();
    });
  });

  describe("Cached state", () => {
    it("should return cached with valid CachedResponse JSON", async () => {
      const cachedResponse = {
        statusCode: 201,
        body: '{"id":"123"}',
        contentType: "application/json",
      };
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(
        D2Result.ok({ data: { value: JSON.stringify(cachedResponse) } }),
      );

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse).toEqual(cachedResponse);
    });
  });

  describe("Fail-open", () => {
    it("should fail-open when SET NX returns failure + GET returns failure", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.fail({ messages: ["Redis error"] }));
      mocks.getFn.mockResolvedValue(D2Result.fail({ messages: ["Redis error"] }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when GET returns null value", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: null } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when GET returns undefined value", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: undefined } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when cached response JSON is invalid", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: "not valid json {{{" } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when GET throws", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockRejectedValue(new Error("Redis timeout"));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when SET NX throws", async () => {
      mocks.setNxFn.mockRejectedValue(new Error("Redis connection refused"));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when JSON is a valid array (not a CachedResponse)", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: "[1, 2, 3]" } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      // Array parses fine but has no statusCode → fail-open.
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when JSON object has no statusCode field", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: '{"body":"test"}' } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      // Missing statusCode → typeof check fails → fail-open.
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should fail-open when statusCode is a string instead of number", async () => {
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: '{"statusCode":"200"}' } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      // statusCode is string, not number → fail-open.
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });
  });

  describe("Serialization edge cases", () => {
    it("should handle cached response with Unicode body", async () => {
      const cached = {
        statusCode: 200,
        body: '{"city":"日本語","emoji":"🎉"}',
        contentType: "application/json",
      };
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: JSON.stringify(cached) } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.body).toContain("日本語");
      expect(result.data?.cachedResponse?.body).toContain("🎉");
    });

    it("should handle cached response with nested escaped JSON in body", async () => {
      const bodyWithEscapedJson = '{"data":"{\\"key\\":\\"value\\"}"}';
      const cached = {
        statusCode: 200,
        body: bodyWithEscapedJson,
        contentType: "application/json",
      };
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: JSON.stringify(cached) } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.body).toBe(bodyWithEscapedJson);
    });

    it("should handle cached response with null body and contentType", async () => {
      const cached = { statusCode: 204, body: undefined, contentType: undefined };
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: JSON.stringify(cached) } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.statusCode).toBe(204);
    });

    it("should handle cached response with statusCode 0 (footgun: invalid HTTP status)", async () => {
      const cached = { statusCode: 0, body: undefined, contentType: undefined };
      mocks.setNxFn.mockResolvedValue(D2Result.ok({ data: { wasSet: false } }));
      mocks.getFn.mockResolvedValue(D2Result.ok({ data: { value: JSON.stringify(cached) } }));

      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "test-key" });

      // statusCode 0 passes the typeof === "number" check — documents this footgun.
      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("cached");
      expect(result.data?.cachedResponse?.statusCode).toBe(0);
    });
  });

  describe("Input validation", () => {
    it("should return validationFailed for empty idempotency key", async () => {
      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "" });

      expect(result).toBeFailure();
      expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
      // Should not have tried any cache operations.
      expect(mocks.setNxFn).not.toHaveBeenCalled();
    });

    it("should return validationFailed for key exceeding 256 characters", async () => {
      const handler = createCheck(mocks);
      const longKey = "a".repeat(257);
      const result = await handler.handleAsync({ idempotencyKey: longKey });

      expect(result).toBeFailure();
      expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
      // Should not have tried any cache operations.
      expect(mocks.setNxFn).not.toHaveBeenCalled();
    });

    it("should accept a valid UUID key", async () => {
      const handler = createCheck(mocks);
      const result = await handler.handleAsync({
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should accept a key at exactly 256 characters", async () => {
      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "x".repeat(256) });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });

    it("should accept a single character key", async () => {
      const handler = createCheck(mocks);
      const result = await handler.handleAsync({ idempotencyKey: "a" });

      expect(result).toBeSuccess();
      expect(result.data?.state).toBe("acquired");
    });
  });
});
