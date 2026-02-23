import { describe, it, expect, vi } from "vitest";
import { createAuthEventConsumer } from "@d2/comms-infra";
import { ConsumerResult } from "@d2/messaging";
import type { IncomingMessage } from "@d2/messaging";
import { D2Result } from "@d2/result";
import type { ServiceProvider, ServiceScope } from "@d2/di";
import { COMMS_RETRY } from "@d2/comms-domain";

describe("createAuthEventConsumer", () => {
  function createMockHandler() {
    return {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    };
  }

  function createMockRetryPublisher() {
    return {
      send: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
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

  function createMockMessageBus() {
    let capturedHandler: ((msg: IncomingMessage<unknown>) => Promise<ConsumerResult | void>) | null =
      null;

    return {
      subscribeEnriched: vi
        .fn()
        .mockImplementation(
          (
            _config: unknown,
            handler: (msg: IncomingMessage<unknown>) => Promise<ConsumerResult | void>,
          ) => {
            capturedHandler = handler;
            return { ready: Promise.resolve(), close: vi.fn() };
          },
        ),
      getCapturedHandler: () => capturedHandler,
    };
  }

  /**
   * Creates a mock ServiceProvider + createScope that returns a scope resolving
   * the given mock handler for any ServiceKey.
   */
  function createMockProviderAndScope(mockHandler?: { handleAsync: ReturnType<typeof vi.fn> }) {
    const handler = mockHandler ?? createMockHandler();
    const scope: ServiceScope = {
      resolve: vi.fn().mockReturnValue(handler),
      tryResolve: vi.fn().mockReturnValue(handler),
      dispose: vi.fn(),
      setInstance: vi.fn(),
      createScope: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    } as unknown as ServiceScope;

    const provider = {} as ServiceProvider;
    const createScope = vi.fn().mockReturnValue(scope);

    return { provider, createScope, scope, handler };
  }

  function createDeps() {
    const bus = createMockMessageBus();
    const { provider, createScope, scope, handler } = createMockProviderAndScope();
    const retryPublisher = createMockRetryPublisher();
    const logger = createMockLogger();
    return { bus, provider, createScope, scope, handler, retryPublisher, logger };
  }

  function makeIncomingMessage(
    body: unknown,
    headers: Record<string, unknown> = {},
  ): IncomingMessage<unknown> {
    return { body, headers, redelivered: false };
  }

  it("should use subscribeEnriched on comms.auth-events queue", () => {
    const { bus, provider, createScope, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });

    expect(bus.subscribeEnriched).toHaveBeenCalledOnce();
    const config = bus.subscribeEnriched.mock.calls[0][0];
    expect(config.queue).toBe("comms.auth-events");
    expect(config.queueOptions.durable).toBe(true);
    expect(config.exchanges[0].exchange).toBe("events.auth");
    expect(config.exchanges[0].type).toBe("fanout");
  });

  it("should dispatch verification email event by shape", async () => {
    const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    await consumerHandler(
      makeIncomingMessage({
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        verificationUrl: "https://example.com/verify/abc",
        token: "abc",
      }),
    );

    expect(handler.handleAsync).toHaveBeenCalledOnce();
    const event = handler.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-1");
    expect(event.verificationUrl).toBe("https://example.com/verify/abc");
  });

  it("should dispatch password reset event by shape", async () => {
    const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    await consumerHandler(
      makeIncomingMessage({
        userId: "user-2",
        email: "reset@example.com",
        name: "Reset User",
        resetUrl: "https://example.com/reset/xyz",
        token: "xyz",
      }),
    );

    expect(handler.handleAsync).toHaveBeenCalledOnce();
    const event = handler.handleAsync.mock.calls[0][0];
    expect(event.userId).toBe("user-2");
    expect(event.resetUrl).toBe("https://example.com/reset/xyz");
  });

  it("should dispatch invitation email event by shape", async () => {
    const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    await consumerHandler(
      makeIncomingMessage({
        invitationId: "inv-1",
        inviteeEmail: "invitee@example.com",
        organizationId: "org-1",
        organizationName: "Acme Corp",
        role: "agent",
        inviterName: "Jane Doe",
        inviterEmail: "jane@example.com",
        invitationUrl: "https://example.com/accept?id=inv-1",
      }),
    );

    expect(handler.handleAsync).toHaveBeenCalledOnce();
    const event = handler.handleAsync.mock.calls[0][0];
    expect(event.invitationId).toBe("inv-1");
    expect(event.organizationName).toBe("Acme Corp");
    expect(event.invitationUrl).toBe("https://example.com/accept?id=inv-1");
  });

  it("should silently ignore unknown event shapes", async () => {
    const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    const result = await consumerHandler(
      makeIncomingMessage({
        userId: "user-3",
        someOtherField: "value",
      }),
    );

    expect(result).toBe(ConsumerResult.ACK);
    expect(handler.handleAsync).not.toHaveBeenCalled();
    expect(createScope).not.toHaveBeenCalled();
    expect(retryPublisher.send).not.toHaveBeenCalled();
  });

  it("should apply proto fromJSON deserialization before dispatching", async () => {
    const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    await consumerHandler(
      makeIncomingMessage({
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        verificationUrl: "https://example.com/verify/abc",
        token: "tok-1",
      }),
    );

    const event = handler.handleAsync.mock.calls[0][0];
    expect(event).toHaveProperty("userId");
    expect(event).toHaveProperty("email");
    expect(event).toHaveProperty("name");
    expect(event).toHaveProperty("verificationUrl");
    expect(event).toHaveProperty("token");
  });

  it("should dispose scope after successful handler execution", async () => {
    const { bus, provider, createScope, scope, retryPublisher, logger } = createDeps();

    createAuthEventConsumer({
      messageBus: bus as never,
      provider,
      createScope,
      retryPublisher,
      logger: logger as never,
    });
    const consumerHandler = bus.getCapturedHandler()!;

    await consumerHandler(
      makeIncomingMessage({
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        verificationUrl: "https://example.com/verify/abc",
        token: "abc",
      }),
    );

    expect(scope.dispose).toHaveBeenCalledOnce();
  });

  describe("retry on delivery failure (D2Result)", () => {
    it("should re-publish to tier-1 queue when handler returns DELIVERY_FAILED", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed for 1 channel(s), retry scheduled."],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const body = {
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        verificationUrl: "https://example.com/verify/abc",
        token: "abc",
      };

      const result = await consumerHandler(makeIncomingMessage(body));

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).toHaveBeenCalledOnce();

      const [target, sentBody] = retryPublisher.send.mock.calls[0];
      expect(target.routingKey).toBe("comms.retry.tier-1");
      expect(target.exchange).toBe("");
      expect(target.headers?.["x-retry-count"]).toBe(1);
      expect(sentBody).toEqual(body);
    });

    it("should re-publish to tier-3 on retryCount 2", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const body = {
        userId: "user-2",
        email: "reset@example.com",
        name: "Reset User",
        resetUrl: "https://example.com/reset/xyz",
        token: "xyz",
      };

      await consumerHandler({ body, headers: { "x-retry-count": 2 }, redelivered: false });

      const [target] = retryPublisher.send.mock.calls[0];
      expect(target.routingKey).toBe("comms.retry.tier-3");
      expect(target.headers?.["x-retry-count"]).toBe(3);
    });

    it("should cap at tier-5 for retryCount 5+", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Still failing"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler({
        body: {
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        },
        headers: { "x-retry-count": 7 },
        redelivered: false,
      });

      const [target] = retryPublisher.send.mock.calls[0];
      expect(target.routingKey).toBe("comms.retry.tier-5");
      expect(target.headers?.["x-retry-count"]).toBe(8);
    });

    it("should drop message at max attempts (retryCount 10)", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Permanent fail"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const result = await consumerHandler({
        body: {
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        },
        headers: { "x-retry-count": 10 },
        redelivered: false,
      });

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledOnce();
    });

    it("should NOT retry when handler returns a non-DELIVERY_FAILED failure", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.notFound({ messages: ["Recipient not found"] }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const result = await consumerHandler(
        makeIncomingMessage({
          userId: "user-1",
          email: "test@example.com",
          name: "Test User",
          verificationUrl: "https://example.com/verify/abc",
          token: "abc",
        }),
      );

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).not.toHaveBeenCalled();
    });

    it("should log warning when scheduling retry", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "Handler failed, scheduling retry",
        expect.objectContaining({
          retryCount: 1,
          tierQueue: "comms.retry.tier-1",
        }),
      );
    });

    it("should preserve existing headers when re-publishing for retry", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler({
        body: {
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        },
        headers: { "x-retry-count": 1, "x-custom": "preserved" },
        redelivered: false,
      });

      const [target] = retryPublisher.send.mock.calls[0];
      expect(target.headers?.["x-custom"]).toBe("preserved");
      expect(target.headers?.["x-retry-count"]).toBe(2);
    });
  });

  describe("retry on unexpected error (catch block)", () => {
    it("should retry when scope.resolve throws (DI failure)", async () => {
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      const scope = {
        resolve: vi.fn().mockImplementation(() => {
          throw new Error("Service not registered: Comms.App.HandleVerificationEmail");
        }),
        dispose: vi.fn(),
      } as unknown as ServiceScope;

      const provider = {} as ServiceProvider;
      const createScope = vi.fn().mockReturnValue(scope);

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const body = {
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        verificationUrl: "https://example.com/verify/abc",
        token: "abc",
      };

      const result = await consumerHandler(makeIncomingMessage(body));

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        "Handler failed, scheduling retry",
        expect.objectContaining({
          retryCount: 1,
          tierQueue: "comms.retry.tier-1",
          error: "Service not registered: Comms.App.HandleVerificationEmail",
        }),
      );
    });

    it("should still dispose scope when resolve throws", async () => {
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      const scope = {
        resolve: vi.fn().mockImplementation(() => {
          throw new Error("DI failure");
        }),
        dispose: vi.fn(),
      } as unknown as ServiceScope;

      const provider = {} as ServiceProvider;
      const createScope = vi.fn().mockReturnValue(scope);

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      // Scope disposal happens in the finally block even on exception
      // Note: the catch is outside the try/finally that contains createScope,
      // but createScope is called before the inner try, so scope.dispose IS called
      // IF the error happens inside the inner try.
      // Actually, re-reading the consumer: scope is created, then try { resolve + handleAsync }
      // finally { scope.dispose() }. But the catch wraps both createScope AND the inner try.
      // So if resolve throws, the finally runs, AND THEN the catch runs.
      expect(scope.dispose).toHaveBeenCalledOnce();
    });
  });

  describe("scope lifecycle", () => {
    it("should dispose scope after DELIVERY_FAILED result", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed"],
          statusCode: 503,
          errorCode: COMMS_RETRY.DELIVERY_FAILED,
        }),
      );
      const { provider, createScope, scope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(scope.dispose).toHaveBeenCalledOnce();
    });

    it("should dispose scope after non-DELIVERY_FAILED failure (terminal, no retry)", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.notFound({ messages: ["Recipient not found"] }),
      );
      const { provider, createScope, scope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(scope.dispose).toHaveBeenCalledOnce();
      expect(retryPublisher.send).not.toHaveBeenCalled();
    });

    it("should create a fresh scope per message", async () => {
      const { bus, provider, createScope, handler, retryPublisher, logger } = createDeps();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({
          userId: "u1",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );
      await consumerHandler(
        makeIncomingMessage({
          userId: "u2",
          email: "e",
          name: "n",
          resetUrl: "https://r",
          token: "t",
        }),
      );

      // Two messages → two scopes created
      expect(createScope).toHaveBeenCalledTimes(2);
    });

    it("should NOT create scope for unknown events", async () => {
      const { bus, provider, createScope, retryPublisher, logger } = createDeps();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      await consumerHandler(
        makeIncomingMessage({ userId: "u1", unknownField: "value" }),
      );

      expect(createScope).not.toHaveBeenCalled();
    });
  });

  describe("error code specificity", () => {
    it("should NOT retry on VALIDATION_FAILED error", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Bad input"],
          statusCode: 400,
          errorCode: "VALIDATION_FAILED",
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const result = await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).not.toHaveBeenCalled();
    });

    it("should NOT retry on CONFLICT error", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Already exists"],
          statusCode: 409,
          errorCode: "CONFLICT",
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const result = await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).not.toHaveBeenCalled();
    });

    it("should NOT retry on UNAUTHORIZED error", async () => {
      const failHandler = createMockHandler();
      failHandler.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Unauthorized"],
          statusCode: 401,
          errorCode: "UNAUTHORIZED",
        }),
      );
      const { provider, createScope } = createMockProviderAndScope(failHandler);
      const bus = createMockMessageBus();
      const retryPublisher = createMockRetryPublisher();
      const logger = createMockLogger();

      createAuthEventConsumer({
        messageBus: bus as never,
        provider,
        createScope,
        retryPublisher,
        logger: logger as never,
      });
      const consumerHandler = bus.getCapturedHandler()!;

      const result = await consumerHandler(
        makeIncomingMessage({
          userId: "u",
          email: "e",
          name: "n",
          verificationUrl: "https://v",
          token: "t",
        }),
      );

      expect(result).toBe(ConsumerResult.ACK);
      expect(retryPublisher.send).not.toHaveBeenCalled();
    });
  });
});
