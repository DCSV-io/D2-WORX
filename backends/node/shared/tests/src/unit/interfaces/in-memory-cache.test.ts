import { describe, it, expect } from "vitest";
import { D2Result, HttpStatusCode } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";

// ---------------------------------------------------------------------------
// Mock handler implementations (verify type contracts compile correctly)
// ---------------------------------------------------------------------------

class MockGetHandler<TValue> implements InMemoryCache.IGetHandler<TValue> {
  private readonly store: Map<string, TValue>;

  constructor(initial?: Record<string, TValue>) {
    this.store = new Map(Object.entries(initial ?? {}));
  }

  async handleAsync(
    input: InMemoryCache.GetInput,
  ): Promise<D2Result<InMemoryCache.GetOutput<TValue> | undefined>> {
    const value = this.store.get(input.key);
    if (value === undefined) {
      return D2Result.notFound();
    }
    return D2Result.ok({ data: { value } });
  }
}

class MockGetManyHandler<TValue> implements InMemoryCache.IGetManyHandler<TValue> {
  private readonly store: Map<string, TValue>;

  constructor(initial?: Record<string, TValue>) {
    this.store = new Map(Object.entries(initial ?? {}));
  }

  async handleAsync(
    input: InMemoryCache.GetManyInput,
  ): Promise<D2Result<InMemoryCache.GetManyOutput<TValue> | undefined>> {
    const values: Record<string, TValue> = {};
    for (const key of input.keys) {
      const value = this.store.get(key);
      if (value !== undefined) {
        values[key] = value;
      }
    }
    return D2Result.ok({ data: { values } });
  }
}

class MockSetHandler<TValue> implements InMemoryCache.ISetHandler<TValue> {
  readonly store = new Map<string, TValue>();

  async handleAsync(
    input: InMemoryCache.SetInput<TValue>,
  ): Promise<D2Result<InMemoryCache.SetOutput | undefined>> {
    this.store.set(input.key, input.value);
    return D2Result.ok({ data: {} });
  }
}

class MockSetManyHandler<TValue> implements InMemoryCache.ISetManyHandler<TValue> {
  readonly store = new Map<string, TValue>();

  async handleAsync(
    input: InMemoryCache.SetManyInput<TValue>,
  ): Promise<D2Result<InMemoryCache.SetManyOutput | undefined>> {
    for (const [key, value] of Object.entries(input.values)) {
      this.store.set(key, value);
    }
    return D2Result.ok({ data: {} });
  }
}

class MockRemoveHandler implements InMemoryCache.IRemoveHandler {
  readonly store = new Map<string, unknown>();

  async handleAsync(
    input: InMemoryCache.RemoveInput,
  ): Promise<D2Result<InMemoryCache.RemoveOutput | undefined>> {
    this.store.delete(input.key);
    return D2Result.ok({ data: {} });
  }
}

// ---------------------------------------------------------------------------
// IGetHandler
// ---------------------------------------------------------------------------

describe("InMemoryCache.IGetHandler", () => {
  it("returns value when key exists", async () => {
    const handler = new MockGetHandler({ "key-1": "hello" });

    const result = await handler.handleAsync({ key: "key-1" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toBe("hello");
  });

  it("returns not found when key does not exist", async () => {
    const handler = new MockGetHandler<string>();

    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeFailure();
    expect(result).toHaveStatusCode(HttpStatusCode.NotFound);
  });

  it("value type is non-optional (TValue, not TValue | undefined)", async () => {
    const handler = new MockGetHandler({ k: 42 });
    const result = await handler.handleAsync({ key: "k" });
    const output = result.checkSuccess();

    // GetOutput.value is TValue (number), not number | undefined
    expect(output).toBeDefined();
    if (output) {
      const value: number = output.value;
      expect(value).toBe(42);
    }
  });
});

// ---------------------------------------------------------------------------
// IGetManyHandler
// ---------------------------------------------------------------------------

describe("InMemoryCache.IGetManyHandler", () => {
  it("returns values for existing keys", async () => {
    const handler = new MockGetManyHandler({ a: 1, b: 2, c: 3 });

    const result = await handler.handleAsync({ keys: ["a", "c"] });

    expect(result).toBeSuccess();
    expect(result.data?.values).toEqual({ a: 1, c: 3 });
  });

  it("returns empty record when no keys match", async () => {
    const handler = new MockGetManyHandler<number>();

    const result = await handler.handleAsync({ keys: ["x", "y"] });

    expect(result).toBeSuccess();
    expect(result.data?.values).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// ISetHandler
// ---------------------------------------------------------------------------

describe("InMemoryCache.ISetHandler", () => {
  it("stores a value with required fields", async () => {
    const handler = new MockSetHandler<string>();

    const result = await handler.handleAsync({ key: "k", value: "v" });

    expect(result).toBeSuccess();
    expect(handler.store.get("k")).toBe("v");
  });

  it("accepts optional expirationMs", async () => {
    const handler = new MockSetHandler<string>();

    const result = await handler.handleAsync({
      key: "k",
      value: "v",
      expirationMs: 60_000,
    });

    expect(result).toBeSuccess();
  });

  it("expirationMs is optional (defaults to undefined)", async () => {
    const input: InMemoryCache.SetInput<string> = { key: "k", value: "v" };
    expect(input.expirationMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ISetManyHandler
// ---------------------------------------------------------------------------

describe("InMemoryCache.ISetManyHandler", () => {
  it("stores multiple values", async () => {
    const handler = new MockSetManyHandler<number>();

    const result = await handler.handleAsync({
      values: { a: 1, b: 2 },
    });

    expect(result).toBeSuccess();
    expect(handler.store.get("a")).toBe(1);
    expect(handler.store.get("b")).toBe(2);
  });

  it("accepts optional expirationMs", async () => {
    const handler = new MockSetManyHandler<number>();

    const result = await handler.handleAsync({
      values: { a: 1 },
      expirationMs: 30_000,
    });

    expect(result).toBeSuccess();
  });
});

// ---------------------------------------------------------------------------
// IRemoveHandler
// ---------------------------------------------------------------------------

describe("InMemoryCache.IRemoveHandler", () => {
  it("removes a key", async () => {
    const handler = new MockRemoveHandler();
    handler.store.set("k", "value");

    const result = await handler.handleAsync({ key: "k" });

    expect(result).toBeSuccess();
    expect(handler.store.has("k")).toBe(false);
  });
});
