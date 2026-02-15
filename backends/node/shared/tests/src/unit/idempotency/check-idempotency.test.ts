import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIdempotency } from "@d2/idempotency";
import { D2Result } from "@d2/result";
import type { DistributedCache, Idempotency } from "@d2/interfaces";
import type { ILogger } from "@d2/logging";

function createMockCheckHandler(
  state: Idempotency.IdempotencyState,
  cachedResponse?: Idempotency.CachedResponse,
) {
  const fn = vi.fn().mockResolvedValue(D2Result.ok({ data: { state, cachedResponse } }));
  return { handleAsync: fn } as unknown as Idempotency.ICheckHandler;
}

function createMockSetHandler() {
  const fn = vi.fn().mockResolvedValue(D2Result.ok({ data: {} }));
  return {
    handler: { handleAsync: fn } as unknown as DistributedCache.ISetHandler<string>,
    fn,
  };
}

function createMockRemoveHandler() {
  const fn = vi.fn().mockResolvedValue(D2Result.ok({ data: {} }));
  return {
    handler: { handleAsync: fn } as unknown as DistributedCache.IRemoveHandler,
    fn,
  };
}

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    level: "silent",
  } as unknown as ILogger;
}

describe("checkIdempotency orchestrator", () => {
  let setMock: ReturnType<typeof createMockSetHandler>;
  let removeMock: ReturnType<typeof createMockRemoveHandler>;

  beforeEach(() => {
    setMock = createMockSetHandler();
    removeMock = createMockRemoveHandler();
  });

  describe("state passthrough", () => {
    it("should return acquired state from check handler", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      expect(result.state).toBe("acquired");
      expect(result.cachedResponse).toBeUndefined();
    });

    it("should return in_flight state from check handler", async () => {
      const check = createMockCheckHandler("in_flight");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      expect(result.state).toBe("in_flight");
    });

    it("should return cached state with response from check handler", async () => {
      const cachedResponse = {
        statusCode: 200,
        body: '{"ok":true}',
        contentType: "application/json",
      };
      const check = createMockCheckHandler("cached", cachedResponse);
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      expect(result.state).toBe("cached");
      expect(result.cachedResponse).toEqual(cachedResponse);
    });
  });

  describe("storeResponse", () => {
    it("should call SET with correct key and TTL", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("my-key", check, setMock.handler, removeMock.handler);

      await result.storeResponse({
        statusCode: 201,
        body: '{"id":"1"}',
        contentType: "application/json",
      });

      expect(setMock.fn).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "idempotency:my-key",
          expirationMs: 86_400_000, // default 24h
        }),
      );
    });

    it("should use custom cacheTtlMs option", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("my-key", check, setMock.handler, removeMock.handler, {
        cacheTtlMs: 3600_000,
      });

      await result.storeResponse({ statusCode: 200, body: undefined, contentType: undefined });

      expect(setMock.fn).toHaveBeenCalledWith(
        expect.objectContaining({
          expirationMs: 3600_000,
        }),
      );
    });

    it("should not throw when SET fails", async () => {
      setMock.fn.mockRejectedValue(new Error("Redis write failed"));
      const logger = createMockLogger();
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency(
        "my-key",
        check,
        setMock.handler,
        removeMock.handler,
        {},
        logger,
      );

      await expect(
        result.storeResponse({ statusCode: 200, body: undefined, contentType: undefined }),
      ).resolves.not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("removeLock", () => {
    it("should call REMOVE with correct key", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("my-key", check, setMock.handler, removeMock.handler);

      await result.removeLock();

      expect(removeMock.fn).toHaveBeenCalledWith(
        expect.objectContaining({ key: "idempotency:my-key" }),
      );
    });

    it("should not throw when REMOVE fails", async () => {
      removeMock.fn.mockRejectedValue(new Error("Redis remove failed"));
      const logger = createMockLogger();
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency(
        "my-key",
        check,
        setMock.handler,
        removeMock.handler,
        {},
        logger,
      );

      await expect(result.removeLock()).resolves.not.toThrow();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("fail-open", () => {
    it("should default to acquired when check handler returns failure", async () => {
      const fn = vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Error"] }));
      const check = { handleAsync: fn } as unknown as Idempotency.ICheckHandler;

      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      expect(result.state).toBe("acquired");
    });

    it("should default to acquired when check result has no data", async () => {
      const fn = vi.fn().mockResolvedValue(D2Result.ok({ data: undefined }));
      const check = { handleAsync: fn } as unknown as Idempotency.ICheckHandler;

      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      expect(result.state).toBe("acquired");
      expect(result.cachedResponse).toBeUndefined();
    });
  });

  describe("storeResponse serialization", () => {
    it("should serialize CachedResponse with special characters", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      const response = {
        statusCode: 201,
        body: '{"name":"O\'Brien","emoji":"🎉"}',
        contentType: "application/json",
      };
      await result.storeResponse(response);

      const calledWith = setMock.fn.mock.calls[0][0];
      const parsed = JSON.parse(calledWith.value);
      expect(parsed.statusCode).toBe(201);
      expect(parsed.body).toContain("O'Brien");
      expect(parsed.body).toContain("🎉");
    });

    it("should serialize CachedResponse with undefined body and contentType", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      await result.storeResponse({ statusCode: 204, body: undefined, contentType: undefined });

      const calledWith = setMock.fn.mock.calls[0][0];
      const parsed = JSON.parse(calledWith.value);
      expect(parsed.statusCode).toBe(204);
      // undefined fields are omitted by JSON.stringify.
      expect(parsed.body).toBeUndefined();
      expect(parsed.contentType).toBeUndefined();
    });

    it("should serialize CachedResponse with nested JSON in body", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      const body = '{"data":"{\\"key\\":\\"value\\"}"}';
      await result.storeResponse({ statusCode: 200, body, contentType: "application/json" });

      const calledWith = setMock.fn.mock.calls[0][0];
      const parsed = JSON.parse(calledWith.value);
      expect(parsed.body).toBe(body);
    });

    it("should serialize CachedResponse with empty string body", async () => {
      const check = createMockCheckHandler("acquired");
      const result = await checkIdempotency("key-1", check, setMock.handler, removeMock.handler);

      await result.storeResponse({ statusCode: 200, body: "", contentType: "text/plain" });

      const calledWith = setMock.fn.mock.calls[0][0];
      const parsed = JSON.parse(calledWith.value);
      expect(parsed.body).toBe("");
      expect(parsed.contentType).toBe("text/plain");
    });
  });
});
