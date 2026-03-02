import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockConsumer, mockPublisher, mockConnection, MockConnection } = vi.hoisted(() => {
  const mockConsumer = {
    on: vi.fn().mockImplementation((_event: string, cb: () => void) => cb()),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockPublisher = {
    send: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createConsumer: vi.fn().mockReturnValue(mockConsumer),
    createPublisher: vi.fn().mockReturnValue(mockPublisher),
    close: vi.fn().mockResolvedValue(undefined),
    exchangeDeclare: vi.fn().mockResolvedValue(undefined),
    queueDeclare: vi.fn().mockResolvedValue(undefined),
    queueBind: vi.fn().mockResolvedValue(undefined),
  };

  // Vitest 4: vi.fn() must wrap a regular function (not arrow) to support `new`
  const MockConnection = vi.fn(function () {
    return mockConnection;
  });

  return { mockConsumer, mockPublisher, mockConnection, MockConnection };
});

vi.mock("rabbitmq-client", () => ({
  Connection: MockConnection,
}));

const { MessageBus, ConsumerResult } = await import("@d2/messaging");

describe("MessageBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish return values after clearAllMocks wipes them
    MockConnection.mockImplementation(function () {
      return mockConnection;
    });
    mockConnection.createConsumer.mockReturnValue(mockConsumer);
    mockConnection.createPublisher.mockReturnValue(mockPublisher);
    mockConsumer.on.mockImplementation((_event: string, cb: () => void) => cb());
    mockConsumer.close.mockResolvedValue(undefined);
    mockPublisher.send.mockResolvedValue(undefined);
    mockPublisher.close.mockResolvedValue(undefined);
    mockConnection.close.mockResolvedValue(undefined);
    mockConnection.exchangeDeclare.mockResolvedValue(undefined);
    mockConnection.queueDeclare.mockResolvedValue(undefined);
    mockConnection.queueBind.mockResolvedValue(undefined);
  });

  it("should create a connection with the provided URL", () => {
    new MessageBus({ url: "amqp://localhost:5672" });

    expect(MockConnection).toHaveBeenCalledWith({
      url: "amqp://localhost:5672",
      connectionName: undefined,
    });
  });

  it("should pass connectionName to the connection", () => {
    new MessageBus({ url: "amqp://localhost", connectionName: "my-service" });

    expect(MockConnection).toHaveBeenCalledWith({
      url: "amqp://localhost",
      connectionName: "my-service",
    });
  });

  describe("subscribe", () => {
    it("should create a consumer with the correct config", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn();

      bus.subscribe(
        {
          queue: "my-queue",
          queueOptions: { durable: true },
          prefetchCount: 5,
          exchanges: [{ exchange: "my-exchange", type: "topic" }],
          queueBindings: [{ exchange: "my-exchange", routingKey: "test.*" }],
        },
        handler,
      );

      expect(mockConnection.createConsumer).toHaveBeenCalledWith(
        {
          queue: "my-queue",
          queueOptions: { durable: true },
          qos: { prefetchCount: 5 },
          exchanges: [{ exchange: "my-exchange", type: "topic" }],
          queueBindings: [{ exchange: "my-exchange", routingKey: "test.*" }],
        },
        expect.any(Function),
      );
    });

    it("should omit qos when prefetchCount is not set", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.subscribe({ queue: "my-queue" }, vi.fn());

      expect(mockConnection.createConsumer).toHaveBeenCalledWith(
        {
          queue: "my-queue",
          queueOptions: undefined,
          qos: undefined,
          exchanges: undefined,
          queueBindings: undefined,
        },
        expect.any(Function),
      );
    });

    it("should pass typed message body to the handler callback", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);

      bus.subscribe<{ version: string }>({ queue: "q" }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<void>;
      await internalCallback({ body: { version: "1.0.0" } });

      expect(handler).toHaveBeenCalledWith({ version: "1.0.0" });
    });

    it("should apply deserialize function to message body when provided", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);
      const deserialize = vi.fn((raw: unknown) => ({
        version: (raw as { version: string }).version.toUpperCase(),
      }));

      bus.subscribe({ queue: "q", deserialize }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<void>;
      await internalCallback({ body: { version: "1.0.0" } });

      expect(deserialize).toHaveBeenCalledWith({ version: "1.0.0" });
      expect(handler).toHaveBeenCalledWith({ version: "1.0.0".toUpperCase() });
    });

    it("should propagate deserialize errors (nack path)", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn();
      const deserialize = vi.fn(() => {
        throw new Error("Invalid proto JSON");
      });

      bus.subscribe({ queue: "q", deserialize }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<void>;

      await expect(internalCallback({ body: { bad: "data" } })).rejects.toThrow(
        "Invalid proto JSON",
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it("should return a consumer with close method", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const consumer = bus.subscribe({ queue: "q" }, vi.fn());

      await consumer.close();

      expect(mockConsumer.close).toHaveBeenCalled();
    });

    it("should pass queue arguments through queueOptions", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.subscribe(
        {
          queue: "dlx-queue",
          queueOptions: {
            durable: true,
            arguments: { "x-dead-letter-exchange": "retry", "x-message-ttl": 5000 },
          },
        },
        vi.fn(),
      );

      const config = mockConnection.createConsumer.mock.calls[0][0];
      expect(config.queueOptions).toEqual({
        durable: true,
        arguments: { "x-dead-letter-exchange": "retry", "x-message-ttl": 5000 },
      });
    });
  });

  describe("subscribeEnriched", () => {
    it("should create a consumer with requeue: false", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.subscribeEnriched({ queue: "enriched-queue" }, vi.fn().mockResolvedValue(undefined));

      const config = mockConnection.createConsumer.mock.calls[0][0];
      expect(config.requeue).toBe(false);
      expect(config.queue).toBe("enriched-queue");
    });

    it("should pass IncomingMessage with headers to the handler", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);

      bus.subscribeEnriched<{ name: string }>({ queue: "q" }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<number | void>;
      await internalCallback({
        body: { name: "test" },
        headers: { "x-retry-count": 2 },
        messageId: "msg-1",
        correlationId: "corr-1",
        redelivered: false,
      });

      expect(handler).toHaveBeenCalledWith({
        body: { name: "test" },
        headers: { "x-retry-count": 2 },
        messageId: "msg-1",
        correlationId: "corr-1",
        redelivered: false,
      });
    });

    it("should default headers to empty object when not present", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);

      bus.subscribeEnriched<{ name: string }>({ queue: "q" }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<number | void>;
      await internalCallback({
        body: { name: "test" },
        redelivered: false,
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
        }),
      );
    });

    it("should return handler's ConsumerResult to rabbitmq-client", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(ConsumerResult.DROP);

      bus.subscribeEnriched({ queue: "q" }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<number | void>;
      const result = await internalCallback({
        body: {},
        headers: {},
        redelivered: false,
      });

      expect(result).toBe(ConsumerResult.DROP);
    });

    it("should return ACK when handler returns void", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);

      bus.subscribeEnriched({ queue: "q" }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<number | void>;
      const result = await internalCallback({
        body: {},
        headers: {},
        redelivered: false,
      });

      expect(result).toBe(ConsumerResult.ACK);
    });

    it("should apply deserialize function before passing to handler", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const handler = vi.fn().mockResolvedValue(undefined);
      const deserialize = vi.fn((raw: unknown) => ({
        name: (raw as { name: string }).name.toUpperCase(),
      }));

      bus.subscribeEnriched({ queue: "q", deserialize }, handler);

      const internalCallback = mockConnection.createConsumer.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<number | void>;
      await internalCallback({
        body: { name: "hello" },
        headers: {},
        redelivered: false,
      });

      expect(deserialize).toHaveBeenCalledWith({ name: "hello" });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { name: "HELLO" },
        }),
      );
    });

    it("should pass queueOptions and exchanges to the consumer", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.subscribeEnriched(
        {
          queue: "q",
          queueOptions: { durable: true },
          prefetchCount: 10,
          exchanges: [{ exchange: "ex", type: "fanout" }],
          queueBindings: [{ exchange: "ex", routingKey: "" }],
        },
        vi.fn().mockResolvedValue(undefined),
      );

      const config = mockConnection.createConsumer.mock.calls[0][0];
      expect(config.queueOptions).toEqual({ durable: true });
      expect(config.qos).toEqual({ prefetchCount: 10 });
      expect(config.exchanges).toEqual([{ exchange: "ex", type: "fanout" }]);
      expect(config.queueBindings).toEqual([{ exchange: "ex", routingKey: "" }]);
    });
  });

  describe("createPublisher", () => {
    it("should create a publisher with default config", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.createPublisher();

      expect(mockConnection.createPublisher).toHaveBeenCalledWith({
        confirm: true,
        maxAttempts: 2,
        exchanges: undefined,
      });
    });

    it("should create a publisher with custom config", () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      bus.createPublisher({
        confirm: false,
        maxAttempts: 5,
        exchanges: [{ exchange: "events", type: "topic" }],
      });

      expect(mockConnection.createPublisher).toHaveBeenCalledWith({
        confirm: false,
        maxAttempts: 5,
        exchanges: [{ exchange: "events", type: "topic" }],
      });
    });

    it("should send messages to the correct exchange and routing key", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const pub = bus.createPublisher();

      await pub.send({ exchange: "events", routingKey: "geo.updated" }, { version: "2.0" });

      expect(mockPublisher.send).toHaveBeenCalledWith(
        {
          exchange: "events",
          routingKey: "geo.updated",
          headers: undefined,
          expiration: undefined,
          messageId: undefined,
        },
        { version: "2.0" },
      );
    });

    it("should pass headers, expiration, and messageId in the envelope", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const pub = bus.createPublisher();

      await pub.send(
        {
          exchange: "retry",
          routingKey: "comms.retry.tier-1",
          headers: { "x-retry-count": 3 },
          expiration: "5000",
          messageId: "msg-abc",
        },
        { data: "payload" },
      );

      expect(mockPublisher.send).toHaveBeenCalledWith(
        {
          exchange: "retry",
          routingKey: "comms.retry.tier-1",
          headers: { "x-retry-count": 3 },
          expiration: "5000",
          messageId: "msg-abc",
        },
        { data: "payload" },
      );
    });

    it("should delegate close to underlying publisher", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const pub = bus.createPublisher();

      await pub.close();

      expect(mockPublisher.close).toHaveBeenCalled();
    });
  });

  describe("declareTopology", () => {
    it("should declare exchanges", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        exchanges: [{ exchange: "retry-exchange", type: "direct", durable: true }],
      });

      expect(mockConnection.exchangeDeclare).toHaveBeenCalledWith({
        exchange: "retry-exchange",
        type: "direct",
        durable: true,
      });
    });

    it("should default exchange durable to true", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        exchanges: [{ exchange: "ex", type: "fanout" }],
      });

      expect(mockConnection.exchangeDeclare).toHaveBeenCalledWith({
        exchange: "ex",
        type: "fanout",
        durable: true,
      });
    });

    it("should declare queues with arguments", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        queues: [
          {
            queue: "tier-1",
            durable: true,
            arguments: { "x-message-ttl": 5000, "x-dead-letter-exchange": "requeue" },
          },
        ],
      });

      expect(mockConnection.queueDeclare).toHaveBeenCalledWith({
        queue: "tier-1",
        durable: true,
        arguments: { "x-message-ttl": 5000, "x-dead-letter-exchange": "requeue" },
      });
    });

    it("should default queue durable to true", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        queues: [{ queue: "q" }],
      });

      expect(mockConnection.queueDeclare).toHaveBeenCalledWith({
        queue: "q",
        durable: true,
        arguments: undefined,
      });
    });

    it("should declare bindings", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        bindings: [{ exchange: "requeue-ex", queue: "main-queue", routingKey: "comms.events" }],
      });

      expect(mockConnection.queueBind).toHaveBeenCalledWith({
        exchange: "requeue-ex",
        queue: "main-queue",
        routingKey: "comms.events",
      });
    });

    it("should declare multiple exchanges, queues, and bindings in order", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({
        exchanges: [
          { exchange: "ex1", type: "direct" },
          { exchange: "ex2", type: "fanout" },
        ],
        queues: [
          { queue: "q1", arguments: { "x-message-ttl": 1000 } },
          { queue: "q2", arguments: { "x-message-ttl": 2000 } },
        ],
        bindings: [
          { exchange: "ex1", queue: "q1", routingKey: "rk1" },
          { exchange: "ex1", queue: "q2", routingKey: "rk2" },
        ],
      });

      expect(mockConnection.exchangeDeclare).toHaveBeenCalledTimes(2);
      expect(mockConnection.queueDeclare).toHaveBeenCalledTimes(2);
      expect(mockConnection.queueBind).toHaveBeenCalledTimes(2);
    });

    it("should handle empty topology config", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.declareTopology({});

      expect(mockConnection.exchangeDeclare).not.toHaveBeenCalled();
      expect(mockConnection.queueDeclare).not.toHaveBeenCalled();
      expect(mockConnection.queueBind).not.toHaveBeenCalled();
    });
  });

  describe("waitForConnection", () => {
    it("should call onConnect with the given timeout", async () => {
      mockConnection.onConnect = vi.fn().mockResolvedValue(undefined);
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.waitForConnection(5000);

      expect(mockConnection.onConnect).toHaveBeenCalledWith(5000, true);
    });

    it("should use default timeout of 10000ms when none provided", async () => {
      mockConnection.onConnect = vi.fn().mockResolvedValue(undefined);
      const bus = new MessageBus({ url: "amqp://localhost" });

      await bus.waitForConnection();

      expect(mockConnection.onConnect).toHaveBeenCalledWith(10_000, true);
    });

    it("should propagate errors from onConnect", async () => {
      mockConnection.onConnect = vi.fn().mockRejectedValue(new Error("Connection timeout"));
      const bus = new MessageBus({ url: "amqp://localhost" });

      await expect(bus.waitForConnection(100)).rejects.toThrow("Connection timeout");
    });
  });

  it("should delegate close to underlying connection", async () => {
    const bus = new MessageBus({ url: "amqp://localhost" });

    await bus.close();

    expect(mockConnection.close).toHaveBeenCalled();
  });

  it("should support multiple subscriptions and publishers on the same bus", () => {
    const bus = new MessageBus({ url: "amqp://localhost" });

    bus.subscribe({ queue: "q1" }, vi.fn());
    bus.subscribe({ queue: "q2" }, vi.fn());
    bus.createPublisher();
    bus.createPublisher({ confirm: false });

    expect(mockConnection.createConsumer).toHaveBeenCalledTimes(2);
    expect(mockConnection.createPublisher).toHaveBeenCalledTimes(2);
  });
});
