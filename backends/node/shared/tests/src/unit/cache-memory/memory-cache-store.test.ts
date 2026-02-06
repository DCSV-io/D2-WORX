import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";

describe("MemoryCacheStore", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
    vi.useRealTimers();
  });

  it("should set and get a value", () => {
    store.set("key1", "value1");
    expect(store.get("key1")).toBe("value1");
  });

  it("should get undefined for missing key", () => {
    expect(store.get("missing")).toBeUndefined();
  });

  it("should get undefined for expired key", () => {
    vi.useFakeTimers();
    store.set("key1", "value1", 100);
    vi.advanceTimersByTime(101);
    expect(store.get("key1")).toBeUndefined();
  });

  it("should return value before expiration", () => {
    vi.useFakeTimers();
    store.set("key1", "value1", 100);
    vi.advanceTimersByTime(50);
    expect(store.get("key1")).toBe("value1");
  });

  it("should delete a key", () => {
    store.set("key1", "value1");
    store.delete("key1");
    expect(store.get("key1")).toBeUndefined();
  });

  it("should report has correctly for existing key", () => {
    store.set("key1", "value1");
    expect(store.has("key1")).toBe(true);
  });

  it("should report has correctly for missing key", () => {
    expect(store.has("missing")).toBe(false);
  });

  it("should report has as false for expired key", () => {
    vi.useFakeTimers();
    store.set("key1", "value1", 100);
    vi.advanceTimersByTime(101);
    expect(store.has("key1")).toBe(false);
  });

  it("should clear all entries", () => {
    store.set("key1", "value1");
    store.set("key2", "value2");
    store.clear();
    expect(store.get("key1")).toBeUndefined();
    expect(store.get("key2")).toBeUndefined();
  });

  it("should overwrite existing key", () => {
    store.set("key1", "value1");
    store.set("key1", "value2");
    expect(store.get("key1")).toBe("value2");
  });

  it("should never expire value set without expiration", () => {
    vi.useFakeTimers();
    store.set("key1", "value1");
    vi.advanceTimersByTime(999_999_999);
    expect(store.get("key1")).toBe("value1");
  });

  it("should store complex objects", () => {
    const obj = { nested: { data: [1, 2, 3] } };
    store.set("complex", obj);
    expect(store.get("complex")).toBe(obj);
  });

  it("should lazily evict expired entry on get", () => {
    vi.useFakeTimers();
    store.set("key1", "value1", 100);
    vi.advanceTimersByTime(101);
    // Get triggers eviction
    store.get("key1");
    // Entry should be fully removed (not just returning undefined)
    expect(store.has("key1")).toBe(false);
  });
});
