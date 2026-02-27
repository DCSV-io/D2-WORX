import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { SetNx, type ICacheSerializer } from "@d2/cache-redis";
import { HttpStatusCode, ErrorCodes } from "@d2/result";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.SetNx", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should set value when key does not exist", async () => {
    const redis = getRedis();
    const handler = new SetNx<{ name: string }>(redis, createTestContext());
    const result = await handler.handleAsync({ key: "k1", value: { name: "test" } });

    expect(result).toBeSuccess();
    expect(result.data?.wasSet).toBe(true);
    const stored = await redis.get("k1");
    expect(JSON.parse(stored!)).toEqual({ name: "test" });
  });

  it("should not overwrite when key already exists", async () => {
    const redis = getRedis();
    await redis.set("k1", JSON.stringify({ name: "original" }));

    const handler = new SetNx<{ name: string }>(redis, createTestContext());
    const result = await handler.handleAsync({ key: "k1", value: { name: "new" } });

    expect(result).toBeSuccess();
    expect(result.data?.wasSet).toBe(false);
    const stored = await redis.get("k1");
    expect(JSON.parse(stored!)).toEqual({ name: "original" });
  });

  it("should set value with expiration", async () => {
    const redis = getRedis();
    const handler = new SetNx<string>(redis, createTestContext());
    await handler.handleAsync({ key: "k1", value: "v1", expirationMs: 60_000 });

    const pttl = await redis.pttl("k1");
    expect(pttl).toBeGreaterThan(0);
    expect(pttl).toBeLessThanOrEqual(60_000);
  });

  it("should set value without expiration", async () => {
    const redis = getRedis();
    const handler = new SetNx<string>(redis, createTestContext());
    await handler.handleAsync({ key: "k1", value: "v1" });

    const pttl = await redis.pttl("k1");
    // -1 means no expiration
    expect(pttl).toBe(-1);
  });

  it("should set value with custom binary serializer", async () => {
    const redis = getRedis();
    const serializer: ICacheSerializer<number[]> = {
      serialize: (value) => Buffer.from(value),
      deserialize: (raw) => [...raw],
    };

    const handler = new SetNx<number[]>(redis, createTestContext(), serializer);
    const result = await handler.handleAsync({ key: "bin", value: [1, 2, 3] });

    expect(result).toBeSuccess();
    expect(result.data?.wasSet).toBe(true);
    const stored = await redis.getBuffer("bin");
    expect([...stored!]).toEqual([1, 2, 3]);
  });

  it("should return COULD_NOT_BE_SERIALIZED on serialization failure", async () => {
    const redis = getRedis();
    const serializer: ICacheSerializer<unknown> = {
      serialize: () => {
        throw new Error("serialize failed");
      },
      deserialize: () => null,
    };

    const handler = new SetNx<unknown>(redis, createTestContext(), serializer);
    const result = await handler.handleAsync({ key: "k1", value: "v1" });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.InternalServerError);
    expect(result.errorCode).toBe(ErrorCodes.COULD_NOT_BE_SERIALIZED);
  });
});
