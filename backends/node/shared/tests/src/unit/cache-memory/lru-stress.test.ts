import { describe, it, expect } from "vitest";
import { MemoryCacheStore } from "@d2/cache-memory";

describe("MemoryCacheStore LRU stress tests", () => {
  it("should enforce capacity boundary — oldest evicted when one over max", () => {
    const max = 100;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Fill to capacity
    for (let i = 0; i < max; i++) {
      store.set(`key-${i}`, i);
    }
    expect(store.size).toBe(max);

    // Add one more — should evict key-0 (oldest)
    store.set("overflow", 999);
    expect(store.size).toBe(max);
    expect(store.get("key-0")).toBeUndefined();
    expect(store.get("overflow")).toBe(999);
    expect(store.get(`key-${max - 1}`)).toBe(max - 1);
  });

  it("should promote accessed entry and evict the correct LRU", () => {
    const max = 50;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Fill to capacity: key-0 through key-49
    for (let i = 0; i < max; i++) {
      store.set(`key-${i}`, i);
    }

    // Access key-0 to promote it (it would otherwise be evicted first)
    store.get("key-0");

    // Add one more — should evict key-1 (now the LRU), not key-0
    store.set("new-key", "new");
    expect(store.size).toBe(max);
    expect(store.get("key-0")).toBe(0); // Survived — was promoted
    expect(store.get("key-1")).toBeUndefined(); // Evicted — was LRU
    expect(store.get("new-key")).toBe("new");
  });

  it("should handle concurrent reads/writes without corruption", async () => {
    const max = 100;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Run 1000 parallel operations
    const ops: Promise<void>[] = [];
    for (let i = 0; i < 1000; i++) {
      ops.push(
        Promise.resolve().then(() => {
          const key = `key-${i % 200}`; // 200 unique keys, max 100 entries
          if (i % 3 === 0) {
            store.set(key, i);
          } else {
            store.get(key); // May return undefined if evicted
          }
        }),
      );
    }

    await Promise.all(ops);

    // Size must never exceed max
    expect(store.size).toBeLessThanOrEqual(max);
    // Size must be positive (we did many sets)
    expect(store.size).toBeGreaterThan(0);
  });

  it("should clean expired entries on access before LRU eviction", () => {
    const max = 5;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Set 3 entries with 1ms TTL (will expire immediately)
    store.set("expire-1", "a", 1);
    store.set("expire-2", "b", 1);
    store.set("expire-3", "c", 1);

    // Set 2 entries without TTL
    store.set("keep-1", "d");
    store.set("keep-2", "e");
    expect(store.size).toBe(5); // All 5 in store (expired not cleaned yet)

    // Wait for TTL expiration
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }

    // Access expired entries — they get cleaned on get
    expect(store.get("expire-1")).toBeUndefined();
    expect(store.get("expire-2")).toBeUndefined();
    expect(store.get("expire-3")).toBeUndefined();

    // Size should reflect cleanup
    expect(store.size).toBe(2);

    // Now we can add 3 more without hitting LRU eviction on keep-1/keep-2
    store.set("new-1", "f");
    store.set("new-2", "g");
    store.set("new-3", "h");
    expect(store.size).toBe(5);
    expect(store.get("keep-1")).toBe("d");
    expect(store.get("keep-2")).toBe("e");
  });

  it("should handle bulk eviction — fill well past max and verify size", () => {
    const max = 100;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Insert 10,000 entries with max 100
    for (let i = 0; i < 10_000; i++) {
      store.set(`key-${i}`, i);
    }

    // Only the last 100 should remain
    expect(store.size).toBe(max);

    // Verify the last 100 entries are present
    for (let i = 9_900; i < 10_000; i++) {
      expect(store.get(`key-${i}`)).toBe(i);
    }

    // Verify earlier entries were evicted
    expect(store.get("key-0")).toBeUndefined();
    expect(store.get("key-9899")).toBeUndefined();
  });

  it("should maintain correct ordering across mixed operations", () => {
    const max = 10;
    const store = new MemoryCacheStore({ maxEntries: max });

    // Fill to capacity
    for (let i = 0; i < max; i++) {
      store.set(`key-${i}`, i);
    }

    // Access every even key to promote them
    for (let i = 0; i < max; i += 2) {
      store.get(`key-${i}`);
    }

    // Add 5 new keys — should evict the 5 odd keys (LRU, not promoted)
    for (let i = 0; i < 5; i++) {
      store.set(`new-${i}`, 100 + i);
    }

    expect(store.size).toBe(max);

    // Odd keys should be evicted
    for (let i = 1; i < max; i += 2) {
      expect(store.get(`key-${i}`)).toBeUndefined();
    }

    // Even keys should survive
    for (let i = 0; i < max; i += 2) {
      expect(store.get(`key-${i}`)).toBe(i);
    }
  });
});
