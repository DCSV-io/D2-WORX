import { describe, it, expect, beforeEach } from "vitest";
import { GetMany, MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode, ErrorCodes } from "@d2/result";

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

describe("InMemoryCache.GetMany", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  it("should return Ok when all keys found", async () => {
    store.set("a", 1);
    store.set("b", 2);
    const handler = new GetMany<number>(store, createTestContext());
    const result = await handler.handleAsync({ keys: ["a", "b"] });

    expect(result).toBeSuccess();
    expect(result.data?.values).toEqual({ a: 1, b: 2 });
  });

  it("should return NotFound when no keys found", async () => {
    const handler = new GetMany<number>(store, createTestContext());
    const result = await handler.handleAsync({ keys: ["x", "y"] });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });

  it("should return SomeFound when partial keys found", async () => {
    store.set("a", 1);
    const handler = new GetMany<number>(store, createTestContext());
    const result = await handler.handleAsync({ keys: ["a", "b"] });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.PartialContent);
    expect(result.errorCode).toBe(ErrorCodes.SOME_FOUND);
    expect(result.data?.values).toEqual({ a: 1 });
  });

  it("should return NotFound for empty keys array", async () => {
    const handler = new GetMany<number>(store, createTestContext());
    const result = await handler.handleAsync({ keys: [] });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });
});
