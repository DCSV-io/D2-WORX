import { describe, it, expect, beforeEach } from "vitest";
import { SetMany, MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

describe("InMemoryCache.SetMany", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  it("should set multiple values and return Ok", async () => {
    const handler = new SetMany<number>(store, createTestContext());
    const result = await handler.handleAsync({ values: { a: 1, b: 2, c: 3 } });

    expect(result).toBeSuccess();
    expect(store.get("a")).toBe(1);
    expect(store.get("b")).toBe(2);
    expect(store.get("c")).toBe(3);
  });

  it("should set with shared expiration", async () => {
    const handler = new SetMany<string>(store, createTestContext());
    const result = await handler.handleAsync({
      values: { a: "x", b: "y" },
      expirationMs: 5000,
    });

    expect(result).toBeSuccess();
    expect(store.get("a")).toBe("x");
  });

  it("should return Ok for empty values record", async () => {
    const handler = new SetMany<string>(store, createTestContext());
    const result = await handler.handleAsync({ values: {} });

    expect(result).toBeSuccess();
  });
});
