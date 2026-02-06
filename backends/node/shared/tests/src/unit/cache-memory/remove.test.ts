import { describe, it, expect, beforeEach } from "vitest";
import { Remove, MemoryCacheStore } from "@d2/cache-memory";
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

describe("InMemoryCache.Remove", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  it("should remove existing key and return Ok", async () => {
    store.set("k1", "v1");
    const handler = new Remove(store, createTestContext());
    const result = await handler.handleAsync({ key: "k1" });

    expect(result).toBeSuccess();
    expect(store.get("k1")).toBeUndefined();
  });

  it("should return Ok when removing non-existent key", async () => {
    const handler = new Remove(store, createTestContext());
    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
  });
});
