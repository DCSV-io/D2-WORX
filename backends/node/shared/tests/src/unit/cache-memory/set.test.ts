import { describe, it, expect, beforeEach } from "vitest";
import { Set, MemoryCacheStore } from "@d2/cache-memory";
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

describe("InMemoryCache.Set", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  it("should set value and return Ok", async () => {
    const handler = new Set<string>(store, createTestContext());
    const result = await handler.handleAsync({ key: "k1", value: "v1" });

    expect(result).toBeSuccess();
    expect(store.get("k1")).toBe("v1");
  });

  it("should set value with expiration", async () => {
    const handler = new Set<string>(store, createTestContext());
    const result = await handler.handleAsync({ key: "k1", value: "v1", expirationMs: 5000 });

    expect(result).toBeSuccess();
    expect(store.get("k1")).toBe("v1");
  });

  it("should overwrite existing key", async () => {
    store.set("k1", "old");
    const handler = new Set<string>(store, createTestContext());
    await handler.handleAsync({ key: "k1", value: "new" });

    expect(store.get("k1")).toBe("new");
  });
});
