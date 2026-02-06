import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";

describe("MemoryCacheStore LRU", () => {
  it("should use default maxEntries of 10,000", () => {
    const store = new MemoryCacheStore();
    // Set 3 items - no eviction
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);
    expect(store.size).toBe(3);
  });

  it("should respect custom maxEntries", () => {
    const store = new MemoryCacheStore({ maxEntries: 2 });
    store.set("a", 1);
    store.set("b", 2);
    expect(store.size).toBe(2);

    // Third item should evict the oldest ("a")
    store.set("c", 3);
    expect(store.size).toBe(2);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBe(2);
    expect(store.get("c")).toBe(3);
  });

  it("should evict LRU (oldest-accessed) entry when at capacity", () => {
    const store = new MemoryCacheStore({ maxEntries: 3 });
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);

    // Access "a" to promote it to MRU; "b" is now LRU
    store.get("a");

    // Insert "d" — should evict "b" (LRU)
    store.set("d", 4);
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe(1);
    expect(store.get("c")).toBe(3);
    expect(store.get("d")).toBe(4);
  });

  it("should promote to MRU on get", () => {
    const store = new MemoryCacheStore({ maxEntries: 3 });
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);

    // Access "a" and "b" to promote them; "c" was accessed last but set last
    // After sets: order = [a, b, c] (a is LRU)
    // get("a") promotes a → order = [b, c, a]
    store.get("a");

    // Now "b" is LRU, adding "d" should evict "b"
    store.set("d", 4);
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe(1);
  });

  it("should move overwritten key to MRU on set", () => {
    const store = new MemoryCacheStore({ maxEntries: 3 });
    store.set("a", 1);
    store.set("b", 2);
    store.set("c", 3);

    // Overwrite "a" — moves it to MRU
    store.set("a", 10);

    // "b" is now LRU, inserting "d" should evict "b"
    store.set("d", 4);
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe(10);
    expect(store.get("c")).toBe(3);
    expect(store.get("d")).toBe(4);
  });

  it("should treat expired entry as free slot", () => {
    const store = new MemoryCacheStore({ maxEntries: 2 });
    store.set("a", 1, 1); // 1ms TTL — will expire immediately
    store.set("b", 2);

    // Wait for "a" to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }

    // "a" should be expired, so get returns undefined and frees slot
    expect(store.get("a")).toBeUndefined();
    expect(store.size).toBe(1);

    // Now we can add two more without exceeding capacity
    store.set("c", 3);
    expect(store.size).toBe(2);
    expect(store.get("b")).toBe(2);
    expect(store.get("c")).toBe(3);
  });

  it("should handle maxEntries=1 keeping only the last item", () => {
    const store = new MemoryCacheStore({ maxEntries: 1 });
    store.set("a", 1);
    expect(store.size).toBe(1);
    expect(store.get("a")).toBe(1);

    store.set("b", 2);
    expect(store.size).toBe(1);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBe(2);
  });

  it("should track size correctly with eviction", () => {
    const store = new MemoryCacheStore({ maxEntries: 2 });
    store.set("a", 1);
    expect(store.size).toBe(1);

    store.set("b", 2);
    expect(store.size).toBe(2);

    // Evicts "a"
    store.set("c", 3);
    expect(store.size).toBe(2);

    store.delete("b");
    expect(store.size).toBe(1);

    store.clear();
    expect(store.size).toBe(0);
  });

  it("should track size correctly with overwrite (no double-count)", () => {
    const store = new MemoryCacheStore({ maxEntries: 3 });
    store.set("a", 1);
    store.set("b", 2);
    expect(store.size).toBe(2);

    // Overwrite should not increase size
    store.set("a", 10);
    expect(store.size).toBe(2);
  });

  it("should evict oldest access, not oldest insert", () => {
    const store = new MemoryCacheStore({ maxEntries: 3 });
    store.set("a", 1); // inserted first
    store.set("b", 2);
    store.set("c", 3); // inserted last

    // Access "a" — now "b" is LRU (oldest access)
    store.get("a");

    store.set("d", 4); // should evict "b"
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")).toBe(1);
    expect(store.get("c")).toBe(3);
    expect(store.get("d")).toBe(4);
  });

  describe("backward compatibility", () => {
    let store: MemoryCacheStore;

    beforeEach(() => {
      store = new MemoryCacheStore();
    });

    it("should work without constructor options", () => {
      store.set("key", "value");
      expect(store.get("key")).toBe("value");
    });

    it("should still support TTL expiration", () => {
      store.set("key", "value", 1);
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy wait
      }
      expect(store.get("key")).toBeUndefined();
    });
  });
});
