import { describe, it, expect } from "vitest";
import { PingMessageBus } from "@d2/messaging";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import type { MessageBus } from "@d2/messaging";

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

function createMockMessageBus(pingResult: boolean | Error): MessageBus {
  return {
    ping: () => {
      if (pingResult instanceof Error) {
        return Promise.reject(pingResult);
      }
      return Promise.resolve(pingResult);
    },
  } as unknown as MessageBus;
}

describe("PingMessageBus", () => {
  it("should return healthy when message bus is connected", async () => {
    const bus = createMockMessageBus(true);
    const handler = new PingMessageBus(bus, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(true);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBeUndefined();
  });

  it("should return unhealthy when message bus is not ready", async () => {
    const bus = createMockMessageBus(false);
    const handler = new PingMessageBus(bus, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Connection not ready");
  });

  it("should return unhealthy with error when ping throws", async () => {
    const bus = createMockMessageBus(new Error("AMQP connection lost"));
    const handler = new PingMessageBus(bus, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBe("AMQP connection lost");
  });

  it("should return unknown error string for non-Error exceptions", async () => {
    const bus = {
      ping: () => Promise.reject("raw string"),
    } as unknown as MessageBus;
    const handler = new PingMessageBus(bus, createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Unknown error");
  });
});
