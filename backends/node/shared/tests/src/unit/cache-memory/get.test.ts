import { describe, it, expect, beforeEach } from "vitest";
import { Get, MemoryCacheStore } from "@d2/cache-memory";
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

describe("InMemoryCache.Get", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  it("should return Ok with value on cache hit", async () => {
    store.set("key1", { name: "test" });
    const handler = new Get<{ name: string }>(store, createTestContext());
    const result = await handler.handleAsync({ key: "key1" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toEqual({ name: "test" });
  });

  it("should return NotFound on cache miss", async () => {
    const handler = new Get<string>(store, createTestContext());
    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });

  it("should preserve traceId", async () => {
    store.set("key1", "value");
    const handler = new Get<string>(store, createTestContext("my-trace"));
    const result = await handler.handleAsync({ key: "key1" });

    expect(result.traceId).toBe("my-trace");
  });

  it("should return NotFound for expired key", async () => {
    store.set("key1", "value", 1); // 1ms expiration
    await new Promise((r) => setTimeout(r, 10));
    const handler = new Get<string>(store, createTestContext());
    const result = await handler.handleAsync({ key: "key1" });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });
});
