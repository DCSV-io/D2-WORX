import { describe, it, expect, beforeEach } from "vitest";
import { Get, GetMany, Set, MemoryCacheStore } from "@d2/cache-memory";
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

describe("InMemoryCache falsy value edge cases", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  describe("MemoryCacheStore", () => {
    it("should store and retrieve 0", () => {
      store.set("num", 0);
      expect(store.get("num")).toBe(0);
    });

    it("should store and retrieve false", () => {
      store.set("bool", false);
      expect(store.get("bool")).toBe(false);
    });

    it("should store and retrieve null", () => {
      store.set("nil", null);
      expect(store.get("nil")).toBeNull();
    });

    it("should store and retrieve empty string", () => {
      store.set("str", "");
      expect(store.get("str")).toBe("");
    });
  });

  describe("Get handler with falsy values", () => {
    it("should return Ok with 0", async () => {
      store.set("num", 0);
      const handler = new Get<number>(store, createTestContext());
      const result = await handler.handleAsync({ key: "num" });

      expect(result).toBeSuccess();
      expect(result.data?.value).toBe(0);
    });

    it("should return Ok with false", async () => {
      store.set("bool", false);
      const handler = new Get<boolean>(store, createTestContext());
      const result = await handler.handleAsync({ key: "bool" });

      expect(result).toBeSuccess();
      expect(result.data?.value).toBe(false);
    });

    it("should return Ok with null", async () => {
      store.set("nil", null);
      const handler = new Get<null>(store, createTestContext());
      const result = await handler.handleAsync({ key: "nil" });

      expect(result).toBeSuccess();
      expect(result.data?.value).toBeNull();
    });

    it("should return Ok with empty string", async () => {
      store.set("str", "");
      const handler = new Get<string>(store, createTestContext());
      const result = await handler.handleAsync({ key: "str" });

      expect(result).toBeSuccess();
      expect(result.data?.value).toBe("");
    });
  });

  describe("GetMany handler with falsy values", () => {
    it("should return Ok with all falsy values found", async () => {
      store.set("zero", 0);
      store.set("false", false);
      store.set("null", null);
      store.set("empty", "");
      const handler = new GetMany<unknown>(store, createTestContext());
      const result = await handler.handleAsync({
        keys: ["zero", "false", "null", "empty"],
      });

      expect(result).toBeSuccess();
      expect(result.data?.values).toEqual({
        zero: 0,
        false: false,
        null: null,
        empty: "",
      });
    });
  });

  describe("Set handler with falsy values", () => {
    it("should set 0 and retrieve it", async () => {
      const handler = new Set<number>(store, createTestContext());
      await handler.handleAsync({ key: "num", value: 0 });
      expect(store.get("num")).toBe(0);
    });
  });
});
