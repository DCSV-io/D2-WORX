import { describe, it, expect, vi } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { CheckHealth } from "@d2/comms-app";
import type { IPingDbHandler } from "@d2/comms-app";
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

describe("Comms CheckHealth", () => {
  it("should return healthy when all components are healthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createTestContext(),
      createMockPingCache(true),
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
      createTestContext(),
      createMockPingCache(true),
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.db.status).toBe("unhealthy");
    expect(result.data?.components.db.error).toBe("DB connection failed");
  });

  it("should return degraded when cache is unhealthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createTestContext(),
      createMockPingCache(false),
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.cache.status).toBe("unhealthy");
  });

  it("should report cache as not configured when handler is omitted", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createTestContext(),
      undefined,
      createMockPingMessageBus(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components.cache.status).toBe("not configured");
  });

  it("should report messaging as not configured when handler is omitted", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createTestContext(),
      createMockPingCache(true),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components.messaging.status).toBe("not configured");
  });

  it("should return healthy when both optional components are omitted", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true),
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("healthy");
    expect(result.data?.components.cache.status).toBe("not configured");
    expect(result.data?.components.messaging.status).toBe("not configured");
  });

  it("should return degraded when all components are unhealthy", async () => {
    const handler = new CheckHealth(
      createMockPingDb(false),
      createTestContext(),
      createMockPingCache(false),
      createMockPingMessageBus(false),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.status).toBe("degraded");
    expect(result.data?.components.db.status).toBe("unhealthy");
    expect(result.data?.components.cache.status).toBe("unhealthy");
    expect(result.data?.components.messaging.status).toBe("unhealthy");
  });

  it("should include latency for each component", async () => {
    const handler = new CheckHealth(
      createMockPingDb(true, 5),
      createTestContext(),
      createMockPingCache(true, 2),
      createMockPingMessageBus(true, 3),
    );

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.components.db.latencyMs).toBe(5);
    expect(result.data?.components.cache.latencyMs).toBe(2);
    expect(result.data?.components.messaging.latencyMs).toBe(3);
  });
});
