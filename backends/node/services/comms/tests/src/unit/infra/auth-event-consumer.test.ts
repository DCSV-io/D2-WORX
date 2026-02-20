import { describe, it, expect, vi } from "vitest";
import { createAuthEventConsumer } from "@d2/comms-infra";
import { D2Result } from "@d2/result";

describe("createAuthEventConsumer", () => {
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

  function createMockMessageBus() {
    let capturedHandler: ((msg: unknown) => Promise<void>) | null = null;

    return {
      subscribe: vi.fn().mockImplementation((_config: unknown, handler: (msg: unknown) => Promise<void>) => {
        capturedHandler = handler;
        return { close: vi.fn() };
      }),
      getCapturedHandler: () => capturedHandler,
    };
  }

  it("should subscribe to comms.auth-events queue on events.auth exchange", () => {
    const bus = createMockMessageBus();
    const subHandlers = createMockSubHandlers();

    createAuthEventConsumer(bus as any, subHandlers as any);

    expect(bus.subscribe).toHaveBeenCalledOnce();
    const config = bus.subscribe.mock.calls[0][0];
    expect(config.queue).toBe("comms.auth-events");
    expect(config.queueOptions.durable).toBe(true);
    expect(config.exchanges[0].exchange).toBe("events.auth");
    expect(config.exchanges[0].type).toBe("fanout");
  });

  it("should dispatch verification email event by shape", async () => {
    const bus = createMockMessageBus();
    const subHandlers = createMockSubHandlers();

    createAuthEventConsumer(bus as any, subHandlers as any);
    const handler = bus.getCapturedHandler()!;

    await handler({
      userId: "user-1",
      email: "test@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify/abc",
      token: "abc",
    });

    expect(subHandlers.handleVerificationEmail.handleAsync).toHaveBeenCalledOnce();
    expect(subHandlers.handlePasswordReset.handleAsync).not.toHaveBeenCalled();

    const event = subHandlers.handleVerificationEmail.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-1");
    expect(event.verificationUrl).toBe("https://example.com/verify/abc");
  });

  it("should dispatch password reset event by shape", async () => {
    const bus = createMockMessageBus();
    const subHandlers = createMockSubHandlers();

    createAuthEventConsumer(bus as any, subHandlers as any);
    const handler = bus.getCapturedHandler()!;

    await handler({
      userId: "user-2",
      email: "reset@example.com",
      name: "Reset User",
      resetUrl: "https://example.com/reset/xyz",
      token: "xyz",
    });

    expect(subHandlers.handlePasswordReset.handleAsync).toHaveBeenCalledOnce();
    expect(subHandlers.handleVerificationEmail.handleAsync).not.toHaveBeenCalled();

    const event = subHandlers.handlePasswordReset.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-2");
    expect(event.resetUrl).toBe("https://example.com/reset/xyz");
  });

  it("should silently ignore unknown event shapes", async () => {
    const bus = createMockMessageBus();
    const subHandlers = createMockSubHandlers();

    createAuthEventConsumer(bus as any, subHandlers as any);
    const handler = bus.getCapturedHandler()!;

    // Unknown event shape — no verificationUrl or resetUrl
    await handler({
      userId: "user-3",
      someOtherField: "value",
    });

    expect(subHandlers.handleVerificationEmail.handleAsync).not.toHaveBeenCalled();
    expect(subHandlers.handlePasswordReset.handleAsync).not.toHaveBeenCalled();
  });
});
