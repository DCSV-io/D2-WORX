import { describe, it, expect, vi } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { CheckHealth } from "@d2/auth-app";
import type { IPingDbHandler } from "@d2/auth-app";
import type { DistributedCache, Messaging } from "@d2/interfaces";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockPingDb(healthy: boolean, latencyMs = 1): IPingDbHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(
      D2Result.ok({
        data: { healthy, latencyMs, ...(healthy ? {} : { error: "DB connection failed" }) },
      }),
    ),
  } as unknown as IPingDbHandler;
}

function createMockPingCache(healthy: boolean, latencyMs = 1): DistributedCache.IPingHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(
      D2Result.ok({
        data: { healthy, latencyMs, ...(healthy ? {} : { error: "Redis connection failed" }) },
      }),
    ),
  } as unknown as DistributedCache.IPingHandler;
}

function createMockPingMessageBus(healthy: boolean, latencyMs = 1): Messaging.IPingHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(
      D2Result.ok({
        data: {
          healthy,
          latencyMs,
          ...(healthy ? {} : { error: "AMQP connection failed" }),
        },
      }),
    ),
  } as unknown as Messaging.IPingHandler;
}

describe("Auth CheckHealth", () => {
  it("should return healthy when all components are healthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createMockPingCache(true),
      createTestContext(),
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components.db.status).toBe("healthy");
    expect(result.data?.components.cache.status).toBe("healthy");
    expect(result.data?.components.messaging.status).toBe("healthy");
  });

  it("should return degraded when DB is unhealthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(false),
      createMockPingCache(true),
      createTestContext(),
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.db.status).toBe("unhealthy");
    expect(result.data?.components.db.error).toBe("DB connection failed");
    expect(result.data?.components.cache.status).toBe("healthy");
  });

  it("should return degraded when cache is unhealthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createMockPingCache(false),
      createTestContext(),
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.cache.status).toBe("unhealthy");
    expect(result.data?.components.cache.error).toBe("Redis connection failed");
  });

  it("should return degraded when messaging is unhealthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createMockPingCache(true),
      createTestContext(),
      createMockPingMessageBus(false),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.messaging.status).toBe("unhealthy");
  });

  it("should report messaging as not configured when handler is omitted", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createMockPingCache(true),
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components.messaging.status).toBe("not configured");
  });

  it("should include latency for each component", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true, 5),
      createMockPingCache(true, 2),
      createTestContext(),
      createMockPingMessageBus(true, 3),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.components.db.latencyMs).toBe(5);
    expect(result.data?.components.cache.latencyMs).toBe(2);
    expect(result.data?.components.messaging.latencyMs).toBe(3);
  });

  it("should handle ping handler returning no data", async () => {
    const pingDb = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: undefined })),
    } as unknown as IPingDbHandler;

    const handler = new CheckHealth(pingDb, createMockPingCache(true), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.db.status).toBe("unhealthy");
    expect(result.data?.components.db.error).toBe("Ping handler returned no data");
  });
});
