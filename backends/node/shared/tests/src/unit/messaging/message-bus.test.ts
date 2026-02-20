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
  };

  const MockConnection = vi.fn().mockReturnValue(mockConnection);

  return { mockConsumer, mockPublisher, mockConnection, MockConnection };
});

vi.mock("rabbitmq-client", () => ({
  Connection: MockConnection,
}));

const { MessageBus } = await import("@d2/messaging");

describe("MessageBus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish return values after clearAllMocks wipes them
    MockConnection.mockReturnValue(mockConnection);
    mockConnection.createConsumer.mockReturnValue(mockConsumer);
    mockConnection.createPublisher.mockReturnValue(mockPublisher);
    mockConsumer.on.mockImplementation((_event: string, cb: () => void) => cb());
    mockConsumer.close.mockResolvedValue(undefined);
    mockPublisher.send.mockResolvedValue(undefined);
    mockPublisher.close.mockResolvedValue(undefined);
    mockConnection.close.mockResolvedValue(undefined);
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
        { exchange: "events", routingKey: "geo.updated" },
        { version: "2.0" },
      );
    });

    it("should delegate close to underlying publisher", async () => {
      const bus = new MessageBus({ url: "amqp://localhost" });
      const pub = bus.createPublisher();

      await pub.close();

      expect(mockPublisher.close).toHaveBeenCalled();
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
