import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Remove } from "@d2/cache-redis";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.Remove", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should remove existing key", async () => {
    const redis = getRedis();
    await redis.set("k1", "v1");

    const handler = new Remove(redis, createTestContext());
    const result = await handler.handleAsync({ key: "k1" });

    expect(result).toBeSuccess();
    expect(await redis.exists("k1")).toBe(0);
  });

  it("should return Ok when removing non-existent key", async () => {
    const redis = getRedis();
    const handler = new Remove(redis, createTestContext());
    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeSuccess();
  });
});
