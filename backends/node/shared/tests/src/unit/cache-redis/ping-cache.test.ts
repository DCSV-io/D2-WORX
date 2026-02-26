import { describe, it, expect, vi } from "vitest";
import { PingCache } from "@d2/cache-redis";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import type Redis from "ioredis";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockRedis(pingFn: () => Promise<string>): Redis {
  return { ping: pingFn } as unknown as Redis;
}

describe("PingCache", () => {
  it("should return healthy when Redis responds to ping", async () => {
    const redis = createMockRedis(() => Promise.resolve("PONG"));
    const handler = new PingCache(redis, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(true);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBeUndefined();
  });

  it("should return unhealthy with error when Redis throws", async () => {
    const redis = createMockRedis(() => Promise.reject(new Error("Connection refused")));
    const handler = new PingCache(redis, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBe("Connection refused");
  });

  it("should return unknown error string for non-Error exceptions", async () => {
    const redis = createMockRedis(() => Promise.reject("string error"));
    const handler = new PingCache(redis, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Unknown error");
  });

  it("should measure latency", async () => {
    const redis = createMockRedis(
      () => new Promise((resolve) => setTimeout(() => resolve("PONG"), 10)),
    );
    const handler = new PingCache(redis, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(5);
  });
});
