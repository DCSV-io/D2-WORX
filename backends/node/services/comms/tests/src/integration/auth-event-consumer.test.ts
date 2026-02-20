import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { D2Result } from "@d2/result";
import { createAuthEventConsumer } from "@d2/comms-infra";
import { SendVerificationEmailEventFns, SendPasswordResetEventFns } from "@d2/protos";
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
  beforeAll(startRabbitMQ, 60_000);
  afterAll(stopRabbitMQ);

  function createMockSubHandlers() {
    return {
      handleVerificationEmail: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
      handlePasswordReset: {
        handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
      },
    };
  }

  it("should consume a verification email event from RabbitMQ", async () => {
    const bus = getBus();
    const subHandlers = createMockSubHandlers();

    let resolveDispatched: () => void;
    const dispatched = new Promise<void>((resolve) => {
      resolveDispatched = resolve;
    });
    subHandlers.handleVerificationEmail.handleAsync.mockImplementation(async () => {
      resolveDispatched();
      return D2Result.ok({ data: {} });
    });

    // Wire up the consumer (declares queue + bindings on the broker)
    const consumer = createAuthEventConsumer(bus, subHandlers as never);
    await consumer.ready;

    // Publish the same way auth service does
    const publisher = bus.createPublisher({
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

    expect(subHandlers.handleVerificationEmail.handleAsync).toHaveBeenCalledOnce();
    expect(subHandlers.handlePasswordReset.handleAsync).not.toHaveBeenCalled();

    const event = subHandlers.handleVerificationEmail.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-verify-1");
    expect(event.email).toBe("verify@example.com");
    expect(event.name).toBe("Test User");
    expect(event.verificationUrl).toBe("https://app.d2worx.com/verify/abc123");
    expect(event.token).toBe("abc123");

    await publisher.close();
    await consumer.close();
  });

  it("should consume a password reset event from RabbitMQ", async () => {
    const bus = getBus();
    const subHandlers = createMockSubHandlers();

    let resolveDispatched: () => void;
    const dispatched = new Promise<void>((resolve) => {
      resolveDispatched = resolve;
    });
    subHandlers.handlePasswordReset.handleAsync.mockImplementation(async () => {
      resolveDispatched();
      return D2Result.ok({ data: {} });
    });

    const consumer = createAuthEventConsumer(bus, subHandlers as never);
    await consumer.ready;

    const publisher = bus.createPublisher({
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

    expect(subHandlers.handlePasswordReset.handleAsync).toHaveBeenCalledOnce();
    expect(subHandlers.handleVerificationEmail.handleAsync).not.toHaveBeenCalled();

    const event = subHandlers.handlePasswordReset.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-reset-1");
    expect(event.email).toBe("reset@example.com");
    expect(event.resetUrl).toBe("https://app.d2worx.com/reset/xyz789");

    await publisher.close();
    await consumer.close();
  });

  it("should silently ignore unknown event shapes", async () => {
    const bus = getBus();
    const subHandlers = createMockSubHandlers();

    const consumer = createAuthEventConsumer(bus, subHandlers as never);
    await consumer.ready;

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });
    // Publish an unrecognized event shape
    await publisher.send(
      { exchange: "events.auth", routingKey: "" },
      { userId: "user-unknown", someUnknownField: "value" },
    );

    // Give the consumer time to process (if it does anything)
    await new Promise((r) => setTimeout(r, 1000));

    expect(subHandlers.handleVerificationEmail.handleAsync).not.toHaveBeenCalled();
    expect(subHandlers.handlePasswordReset.handleAsync).not.toHaveBeenCalled();

    await publisher.close();
    await consumer.close();
  });

  it("should handle multiple events in sequence", async () => {
    const bus = getBus();
    const subHandlers = createMockSubHandlers();

    let verifyCount = 0;
    let resetCount = 0;
    let resolveAll: () => void;
    const allDispatched = new Promise<void>((resolve) => {
      resolveAll = resolve;
    });

    subHandlers.handleVerificationEmail.handleAsync.mockImplementation(async () => {
      verifyCount++;
      if (verifyCount + resetCount >= 3) resolveAll();
      return D2Result.ok({ data: {} });
    });
    subHandlers.handlePasswordReset.handleAsync.mockImplementation(async () => {
      resetCount++;
      if (verifyCount + resetCount >= 3) resolveAll();
      return D2Result.ok({ data: {} });
    });

    const consumer = createAuthEventConsumer(bus, subHandlers as never);
    await consumer.ready;

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "events.auth", type: "fanout" }],
    });

    // Publish a mix of events
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

    expect(verifyCount).toBe(2);
    expect(resetCount).toBe(1);

    await publisher.close();
    await consumer.close();
  });
});
