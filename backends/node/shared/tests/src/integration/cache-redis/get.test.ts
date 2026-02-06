import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Get, type ICacheSerializer } from "@d2/cache-redis";
import { HttpStatusCode, ErrorCodes } from "@d2/result";
import {
  startRedis,
  stopRedis,
  getRedis,
  flushRedis,
  createTestContext,
} from "./redis-test-helpers.js";

describe("DistributedCache.Get", () => {
  beforeAll(startRedis, 60_000);
  afterAll(stopRedis);
  beforeEach(flushRedis);

  it("should return Ok with deserialized value on cache hit (JSON)", async () => {
    const redis = getRedis();
    await redis.set("key1", JSON.stringify({ name: "test" }));

    const handler = new Get<{ name: string }>(redis, createTestContext());
    const result = await handler.handleAsync({ key: "key1" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toEqual({ name: "test" });
  });

  it("should return Ok with custom binary serializer", async () => {
    const redis = getRedis();
    const data = Buffer.from([0x01, 0x02, 0x03]);
    await redis.set("bin", data);

    const serializer: ICacheSerializer<number[]> = {
      serialize: (value) => Buffer.from(value),
      deserialize: (raw) => [...raw],
    };

    const handler = new Get<number[]>(redis, createTestContext(), serializer);
    const result = await handler.handleAsync({ key: "bin" });

    expect(result).toBeSuccess();
    expect(result.data?.value).toEqual([1, 2, 3]);
  });

  it("should return NotFound on cache miss", async () => {
    const redis = getRedis();
    const handler = new Get<string>(redis, createTestContext());
    const result = await handler.handleAsync({ key: "missing" });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });

  it("should return COULD_NOT_BE_DESERIALIZED for invalid JSON", async () => {
    const redis = getRedis();
    await redis.set("bad", "not-valid-json{{{");

    const handler = new Get<{ name: string }>(redis, createTestContext());
    const result = await handler.handleAsync({ key: "bad" });

    expect(result).toBeFailure();
    expect(result.statusCode).toBe(HttpStatusCode.InternalServerError);
    expect(result.errorCode).toBe(ErrorCodes.COULD_NOT_BE_DESERIALIZED);
  });

  it("should return COULD_NOT_BE_DESERIALIZED for custom serializer failure", async () => {
    const redis = getRedis();
    await redis.set("bad-bin", "some-data");

    const serializer: ICacheSerializer<unknown> = {
      serialize: () => "",
      deserialize: () => {
        throw new Error("decode failed");
      },
    };

    const handler = new Get<unknown>(redis, createTestContext(), serializer);
    const result = await handler.handleAsync({ key: "bad-bin" });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.COULD_NOT_BE_DESERIALIZED);
  });

  it("should preserve traceId", async () => {
    const redis = getRedis();
    await redis.set("k", JSON.stringify("v"));

    const handler = new Get<string>(redis, createTestContext("my-trace"));
    const result = await handler.handleAsync({ key: "k" });

    expect(result.traceId).toBe("my-trace");
  });
});
