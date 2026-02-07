import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { GetTtl } from "@d2/cache-redis";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.GetTtl", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should return TTL for key with expiration", async () => {
    const redis = getRedis();
    await redis.set("k1", "v1", "PX", 60_000);

    const handler = new GetTtl(redis, createTestContext());
    const result = await handler.handleAsync({ key: "k1" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBeGreaterThan(0);
    expect(result.data?.timeToLiveMs).toBeLessThanOrEqual(60_000);
  });

  it("should return undefined for key without expiration", async () => {
    const redis = getRedis();
    await redis.set("k1", "v1");

    const handler = new GetTtl(redis, createTestContext());
    const result = await handler.handleAsync({ key: "k1" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBeUndefined();
  });

  it("should return undefined for non-existent key", async () => {
    const redis = getRedis();
    const handler = new GetTtl(redis, createTestContext());
    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
    expect(result.data?.timeToLiveMs).toBeUndefined();
  });
});
