import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Increment } from "@d2/cache-redis";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.Increment", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should increment by default amount (1)", async () => {
    const redis = getRedis();
    await redis.set("counter", "5");

    const handler = new Increment(redis, createTestContext());
    const result = await handler.handleAsync({ key: "counter" });

    expect(result).toBeSuccess();
    expect(result.data?.newValue).toBe(6);
  });

  it("should increment by custom amount", async () => {
    const redis = getRedis();
    await redis.set("counter", "10");

    const handler = new Increment(redis, createTestContext());
    const result = await handler.handleAsync({ key: "counter", amount: 5 });

    expect(result).toBeSuccess();
    expect(result.data?.newValue).toBe(15);
  });

  it("should set expiration on increment", async () => {
    const redis = getRedis();
    const handler = new Increment(redis, createTestContext());
    await handler.handleAsync({ key: "counter", expirationMs: 60_000 });

    const pttl = await redis.pttl("counter");
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(60_000);
  });

  it("should create key with initial value when key does not exist", async () => {
    const redis = getRedis();
    const handler = new Increment(redis, createTestContext());
    const result = await handler.handleAsync({ key: "new-counter", amount: 3 });

    expect(result).toBeSuccess();
    expect(result.data?.newValue).toBe(3);
  });
});
