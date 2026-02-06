import { describe, it, expect } from "vitest";
import { D2Result, HttpStatusCode } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";

// ---------------------------------------------------------------------------
// Mock handler implementations (verify type contracts compile correctly)
// ---------------------------------------------------------------------------

class MockGetHandler<TValue> implements DistributedCache.IGetHandler<TValue> {
  private readonly store: Map<string, TValue>;

  constructor(initial?: Record<string, TValue>) {
    this.store = new Map(Object.entries(initial ?? {}));
  }

  async handleAsync(
    input: DistributedCache.GetInput,
  ): Promise<D2Result<DistributedCache.GetOutput<TValue> | undefined>> {
    const value = this.store.get(input.key);
    return D2Result.ok({ data: { value } });
  }
}

class MockExistsHandler implements DistributedCache.IExistsHandler {
  private readonly store: Set<string>;

  constructor(keys?: string[]) {
    this.store = new Set(keys);
  }

  async handleAsync(
    input: DistributedCache.ExistsInput,
  ): Promise<D2Result<DistributedCache.ExistsOutput | undefined>> {
    return D2Result.ok({ data: { exists: this.store.has(input.key) } });
  }
}

class MockGetTtlHandler implements DistributedCache.IGetTtlHandler {
  private readonly ttls: Map<string, number | undefined>;

  constructor(ttls?: Record<string, number | undefined>) {
    this.ttls = new Map(Object.entries(ttls ?? {}));
  }

  async handleAsync(
    input: DistributedCache.GetTtlInput,
  ): Promise<D2Result<DistributedCache.GetTtlOutput | undefined>> {
    const timeToLiveMs = this.ttls.get(input.key);
    return D2Result.ok({ data: { timeToLiveMs } });
  }
}

class MockSetHandler<TValue> implements DistributedCache.ISetHandler<TValue> {
  readonly store = new Map<string, TValue>();

  async handleAsync(
    input: DistributedCache.SetInput<TValue>,
  ): Promise<D2Result<DistributedCache.SetOutput | undefined>> {
    this.store.set(input.key, input.value);
    return D2Result.ok({ data: {} });
  }
}

class MockIncrementHandler implements DistributedCache.IIncrementHandler {
  readonly counters = new Map<string, number>();

  async handleAsync(
    input: DistributedCache.IncrementInput,
  ): Promise<D2Result<DistributedCache.IncrementOutput | undefined>> {
    const current = this.counters.get(input.key) ?? 0;
    const amount = input.amount ?? 1;
    const newValue = current + amount;
    this.counters.set(input.key, newValue);
    return D2Result.ok({ data: { newValue } });
  }
}

class MockRemoveHandler implements DistributedCache.IRemoveHandler {
  readonly store = new Map<string, unknown>();

  async handleAsync(
    input: DistributedCache.RemoveInput,
  ): Promise<D2Result<DistributedCache.RemoveOutput | undefined>> {
    this.store.delete(input.key);
    return D2Result.ok({ data: {} });
  }
}

// ---------------------------------------------------------------------------
// IGetHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.IGetHandler", () => {
  it("returns value when key exists", async () => {
    const handler = new MockGetHandler({ "key-1": "hello" });

    const result = await handler.handleAsync({ key: "key-1" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toBe("hello");
  });

  it("returns undefined value when key does not exist", async () => {
    const handler = new MockGetHandler<string>();

    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toBeUndefined();
  });

  it("value type is TValue | undefined (nullable for distributed cache)", async () => {
    const handler = new MockGetHandler<number>();
    const result = await handler.handleAsync({ key: "missing" });
    const output = result.checkSuccess();

    // GetOutput.value is TValue | undefined — key may not exist
    expect(output).toBeDefined();
    if (output) {
      const value: number | undefined = output.value;
      expect(value).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// IExistsHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.IExistsHandler", () => {
  it("returns true when key exists", async () => {
    const handler = new MockExistsHandler(["a", "b"]);

    const result = await handler.handleAsync({ key: "a" });

    expect(result).toBeSuccess();
    expect(result.data?.exists).toBe(true);
  });

  it("returns false when key does not exist", async () => {
    const handler = new MockExistsHandler([]);

    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
    expect(result.data?.exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IGetTtlHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.IGetTtlHandler", () => {
  it("returns remaining TTL in milliseconds", async () => {
    const handler = new MockGetTtlHandler({ "key-1": 30_000 });

    const result = await handler.handleAsync({ key: "key-1" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBe(30_000);
  });

  it("returns undefined when key has no expiration", async () => {
    const handler = new MockGetTtlHandler({ "key-1": undefined });

    const result = await handler.handleAsync({ key: "key-1" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBeUndefined();
  });

  it("returns undefined when key does not exist", async () => {
    const handler = new MockGetTtlHandler();

    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ISetHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.ISetHandler", () => {
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
});

// ---------------------------------------------------------------------------
// IIncrementHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.IIncrementHandler", () => {
  it("increments by 1 when amount is not specified", async () => {
    const handler = new MockIncrementHandler();

    const result = await handler.handleAsync({ key: "counter" });

    expect(result).toBeSuccess();
    expect(result.data?.newValue).toBe(1);
  });

  it("increments by specified amount", async () => {
    const handler = new MockIncrementHandler();
    handler.counters.set("counter", 10);

    const result = await handler.handleAsync({ key: "counter", amount: 5 });

    expect(result).toBeSuccess();
    expect(result.data?.newValue).toBe(15);
  });

  it("accepts optional expirationMs", async () => {
    const handler = new MockIncrementHandler();

    const result = await handler.handleAsync({
      key: "counter",
      amount: 1,
      expirationMs: 60_000,
    });

    expect(result).toBeSuccess();
  });

  it("amount defaults to undefined (implementation decides default)", async () => {
    const input: DistributedCache.IncrementInput = { key: "counter" };
    expect(input.amount).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// IRemoveHandler
// ---------------------------------------------------------------------------

describe("DistributedCache.IRemoveHandler", () => {
  it("removes a key", async () => {
    const handler = new MockRemoveHandler();
    handler.store.set("k", "value");

    const result = await handler.handleAsync({ key: "k" });

    expect(result).toBeSuccess();
    expect(handler.store.has("k")).toBe(false);
  });
});
