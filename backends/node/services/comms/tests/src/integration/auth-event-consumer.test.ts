import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { D2Result } from "@d2/result";
import { createAuthEventConsumer, declareRetryTopology } from "@d2/comms-infra";
import { SendVerificationEmailEventFns, SendPasswordResetEventFns } from "@d2/protos";
import { COMMS_RETRY } from "@d2/comms-domain";
import type { ServiceProvider, ServiceScope } from "@d2/di";
import type { IMessagePublisher } from "@d2/messaging";
import {
  startRabbitMQ,
  stopRabbitMQ,
  getBus,
  withTimeout,
} from "./helpers/rabbitmq-test-helpers.js";

/**
 * Integration test for createAuthEventConsumer against a real RabbitMQ instance.
 *
 * Verifies the full publish → consume → dispatch flow:
 *   Auth publisher → events.auth exchange → comms.auth-events queue → consumer → sub handler
 */
describe("AuthEventConsumer (integration)", () => {
  // Track resources for cleanup — prevents leaked consumers from stealing messages
  const cleanupFns: (() => Promise<void>)[] = [];

  beforeAll(async () => {
    await startRabbitMQ();
    // Declare retry topology before tests (mirrors composition root)
    await declareRetryTopology(getBus());
  }, 60_000);

  afterEach(async () => {
    // Close all consumers/publishers created in the test, even if assertions failed
    for (const fn of cleanupFns) {
      try {
        await fn();
      } catch {
        // Ignore close errors during cleanup
      }
    }
    cleanupFns.length = 0;
  });

  afterAll(stopRabbitMQ);

  function createMockHandler() {
    return {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    };
  }

  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(),
    };
  }

  /**
   * Creates a mock ServiceProvider + createScope that resolves the given handler
   * for any ServiceKey. Mirrors the real composition root's createServiceScope.
   */
  function createMockProviderAndScope(mockHandler?: { handleAsync: ReturnType<typeof vi.fn> }) {
    const handler = mockHandler ?? createMockHandler();
    const createScope = vi.fn().mockImplementation(() => {
      return {
        resolve: vi.fn().mockReturnValue(handler),
        dispose: vi.fn(),
      } as unknown as ServiceScope;
    });
    const provider = {} as ServiceProvider;
    return { provider, createScope, handler };
  }

  /** Creates a publisher and registers it for automatic cleanup. */
  function createTrackedPublisher(options?: Parameters<ReturnType<typeof getBus>["createPublisher"]>[0]) {
    const pub = getBus().createPublisher(options);
    cleanupFns.push(() => pub.close());
    return pub;
  }

  it("should consume a verification email event from RabbitMQ", async () => {
    const bus = getBus();
    const { provider, createScope, handler } = createMockProviderAndScope();
    const retryPublisher = createTrackedPublisher();
    const logger = createMockLogger();

    let resolveDispatched: () => void;
    const dispatched = new Promise<void>((resolve) => {
      resolveDispatched = resolve;
    });
    handler.handleAsync.mockImplementation(async () => {
      resolveDispatched();
      return D2Result.ok({ data: {} });
    });

    const consumer = createAuthEventConsumer({
      messageBus: bus,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    cleanupFns.push(() => consumer.close());
    await consumer.ready;

    const publisher = createTrackedPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      SendVerificationEmailEventFns.toJSON({
        userId: "user-verify-1",
        email: "verify@example.com",
        name: "Test User",
        verificationUrl: "https://app.d2worx.com/verify/abc123",
        token: "abc123",
      }),
    );

    await withTimeout(dispatched);

    expect(handler.handleAsync).toHaveBeenCalledOnce();

    const event = handler.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-verify-1");
    expect(event.email).toBe("verify@example.com");
    expect(event.name).toBe("Test User");
    expect(event.verificationUrl).toBe("https://app.d2worx.com/verify/abc123");
    expect(event.token).toBe("abc123");
  });

  it("should consume a password reset event from RabbitMQ", async () => {
    const bus = getBus();
    const { provider, createScope, handler } = createMockProviderAndScope();
    const retryPublisher = createTrackedPublisher();
    const logger = createMockLogger();

    let resolveDispatched: () => void;
    const dispatched = new Promise<void>((resolve) => {
      resolveDispatched = resolve;
    });
    handler.handleAsync.mockImplementation(async () => {
      resolveDispatched();
      return D2Result.ok({ data: {} });
    });

    const consumer = createAuthEventConsumer({
      messageBus: bus,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    cleanupFns.push(() => consumer.close());
    await consumer.ready;

    const publisher = createTrackedPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      SendPasswordResetEventFns.toJSON({
        userId: "user-reset-1",
        email: "reset@example.com",
        name: "Reset User",
        resetUrl: "https://app.d2worx.com/reset/xyz789",
        token: "xyz789",
      }),
    );

    await withTimeout(dispatched);

    expect(handler.handleAsync).toHaveBeenCalledOnce();

    const event = handler.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-reset-1");
    expect(event.email).toBe("reset@example.com");
    expect(event.resetUrl).toBe("https://app.d2worx.com/reset/xyz789");
  });

  it("should silently ignore unknown event shapes", async () => {
    const bus = getBus();
    const { provider, createScope, handler } = createMockProviderAndScope();
    const retryPublisher = createTrackedPublisher();
    const logger = createMockLogger();

    const consumer = createAuthEventConsumer({
      messageBus: bus,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    cleanupFns.push(() => consumer.close());
    await consumer.ready;

    const publisher = createTrackedPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      { userId: "user-unknown", someUnknownField: "value" },
    );

    // Give the consumer time to process (if it does anything)
    await new Promise((r) => setTimeout(r, 1000));

    expect(handler.handleAsync).not.toHaveBeenCalled();
    expect(createScope).not.toHaveBeenCalled();
    // retryPublisher is a real publisher (not a spy), so we verify via handler not being called
  });

  it("should handle multiple events in sequence", async () => {
    const bus = getBus();
    const { provider, createScope, handler } = createMockProviderAndScope();
    const retryPublisher = createTrackedPublisher();
    const logger = createMockLogger();

    let callCount = 0;
    let resolveAll: () => void;
    const allDispatched = new Promise<void>((resolve) => {
      resolveAll = resolve;
    });

    handler.handleAsync.mockImplementation(async () => {
      callCount++;
      if (callCount >= 3) resolveAll();
      return D2Result.ok({ data: {} });
    });

    const consumer = createAuthEventConsumer({
      messageBus: bus,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    cleanupFns.push(() => consumer.close());
    await consumer.ready;

    const publisher = createTrackedPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });

    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      SendVerificationEmailEventFns.toJSON({
        userId: "u1",
        email: "a@test.com",
        name: "A",
        verificationUrl: "https://example.com/v/1",
        token: "t1",
      }),
    );
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      SendPasswordResetEventFns.toJSON({
        userId: "u2",
        email: "b@test.com",
        name: "B",
        resetUrl: "https://example.com/r/1",
        token: "t2",
      }),
    );
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      SendVerificationEmailEventFns.toJSON({
        userId: "u3",
        email: "c@test.com",
        name: "C",
        verificationUrl: "https://example.com/v/2",
        token: "t3",
      }),
    );

    await withTimeout(allDispatched);

    expect(callCount).toBe(3);
  });

  it(
    "should retry a failed message via tier queue and redeliver to main queue",
    async () => {
      const bus = getBus();
      const retryPublisher = createTrackedPublisher();
      const logger = createMockLogger();

      let callCount = 0;
      let resolveSecondCall: () => void;
      const secondCall = new Promise<void>((resolve) => {
        resolveSecondCall = resolve;
      });

      const handler = createMockHandler();
      handler.handleAsync.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: return DELIVERY_FAILED to trigger retry
          return D2Result.fail({
            messages: ["Delivery failed for 1 channel(s), retry scheduled."],
            statusCode: 503,
            errorCode: COMMS_RETRY.DELIVERY_FAILED,
          });
        }
        resolveSecondCall();
        return D2Result.ok({ data: {} });
      });

      const { provider, createScope } = createMockProviderAndScope(handler);

      const consumer = createAuthEventConsumer({
        messageBus: bus,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      cleanupFns.push(() => consumer.close());
      await consumer.ready;

      const publisher = createTrackedPublisher({
        exchanges: [{ exchange: "events.auth", type: "fanout" }],
      });
      await publisher.send(
        { exchange: "events.auth", routingKey: "" },
        SendVerificationEmailEventFns.toJSON({
          userId: "user-retry-1",
          email: "retry@example.com",
          name: "Retry User",
          verificationUrl: "https://example.com/verify/retry",
          token: "retry-tok",
        }),
      );

      // tier-1 has 5s TTL, so allow up to 15s for the full retry cycle
      await withTimeout(secondCall, 15_000);

      expect(callCount).toBe(2);
      expect(logger.warn).toHaveBeenCalledWith(
        "Handler failed, scheduling retry",
        expect.objectContaining({ retryCount: 1 }),
      );
    },
    20_000,
  );
});
