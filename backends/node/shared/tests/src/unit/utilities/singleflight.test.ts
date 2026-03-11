import { describe, it, expect, vi } from "vitest";
import { Singleflight } from "@d2/utilities";

describe("Singleflight", () => {
  it("should return the result from a single caller", async () => {
    const sf = new Singleflight();
    const result = await sf.execute("key", () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("should run the operation only once for concurrent callers with the same key", async () => {
    const sf = new Singleflight();
    const operation = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("shared"), 50)),
    );

    const [a, b] = await Promise.all([
      sf.execute("key", operation),
      sf.execute("key", operation),
    ]);

    expect(a).toBe("shared");
    expect(b).toBe("shared");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should run operations independently for different keys", async () => {
    const sf = new Singleflight();
    const opA = vi.fn(() => Promise.resolve("a"));
    const opB = vi.fn(() => Promise.resolve("b"));

    const [a, b] = await Promise.all([
      sf.execute("key-a", opA),
      sf.execute("key-b", opB),
    ]);

    expect(a).toBe("a");
    expect(b).toBe("b");
    expect(opA).toHaveBeenCalledTimes(1);
    expect(opB).toHaveBeenCalledTimes(1);
  });

  it("should propagate errors to all waiters", async () => {
    const sf = new Singleflight();
    const error = new Error("boom");
    const operation = vi.fn(
      () => new Promise<never>((_, reject) => setTimeout(() => reject(error), 50)),
    );

    const results = await Promise.allSettled([
      sf.execute("key", operation),
      sf.execute("key", operation),
    ]);

    expect(results[0]).toEqual({ status: "rejected", reason: error });
    expect(results[1]).toEqual({ status: "rejected", reason: error });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should allow a fresh operation after a successful one completes", async () => {
    const sf = new Singleflight();
    let callCount = 0;

    const result1 = await sf.execute("key", () => {
      callCount++;
      return Promise.resolve("first");
    });
    const result2 = await sf.execute("key", () => {
      callCount++;
      return Promise.resolve("second");
    });

    expect(result1).toBe("first");
    expect(result2).toBe("second");
    expect(callCount).toBe(2);
  });

  it("should allow a fresh retry after a failed operation completes", async () => {
    const sf = new Singleflight();

    await expect(sf.execute("key", () => Promise.reject(new Error("fail")))).rejects.toThrow(
      "fail",
    );

    // Key should be cleaned up — next call starts a new operation
    const result = await sf.execute("key", () => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
  });

  it("should track in-flight count via size and return to 0 after completion", async () => {
    const sf = new Singleflight();
    expect(sf.size).toBe(0);

    let resolveOp!: (value: string) => void;
    const pending = sf.execute(
      "key",
      () => new Promise<string>((resolve) => (resolveOp = resolve)),
    );

    expect(sf.size).toBe(1);

    resolveOp("done");
    await pending;

    expect(sf.size).toBe(0);
  });

  it("should handle N concurrent callers with only one operation execution", async () => {
    const sf = new Singleflight();
    const operation = vi.fn(
      () => new Promise<number>((resolve) => setTimeout(() => resolve(99), 50)),
    );

    const n = 10;
    const promises = Array.from({ length: n }, () => sf.execute("key", operation));
    const results = await Promise.all(promises);

    expect(results).toEqual(Array(n).fill(99));
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
