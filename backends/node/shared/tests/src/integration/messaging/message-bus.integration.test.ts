import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startRabbitMQ, stopRabbitMQ, getBus, withTimeout } from "./rabbitmq-test-helpers.js";

describe("MessageBus integration (RabbitMQ)", () => {
  beforeAll(startRabbitMQ, 60_000);
  afterAll(stopRabbitMQ);

  it("should deliver a published message to a subscriber", async () => {
    const bus = getBus();
    const exchange = "test-rt-exchange";
    const queue = "test-rt-queue";

    let resolveReceived: (msg: { version: string }) => void;
    const received = new Promise<{ version: string }>((resolve) => {
      resolveReceived = resolve;
    });

    const consumer = bus.subscribe<{ version: string }>(
      {
        queue,
        exchanges: [{ exchange, type: "fanout" }],
        queueBindings: [{ exchange, routingKey: "" }],
      },
      async (msg) => {
        resolveReceived(msg);
      },
    );
    await consumer.ready;

    const publisher = bus.createPublisher({
      exchanges: [{ exchange, type: "fanout" }],
    });
    await publisher.send({ exchange, routingKey: "" }, { version: "3.0.0" });

    const result = await withTimeout(received);
    expect(result.version).toBe("3.0.0");

    await publisher.close();
    await consumer.close();
  });

  it("should redeliver when handler throws (nack)", async () => {
    const bus = getBus();
    const exchange = "test-retry-exchange";
    const queue = "test-retry-queue";

    let callCount = 0;
    let resolveSecondCall: (msg: { version: string }) => void;
    const secondCall = new Promise<{ version: string }>((resolve) => {
      resolveSecondCall = resolve;
    });

    const consumer = bus.subscribe<{ version: string }>(
      {
        queue,
        exchanges: [{ exchange, type: "fanout" }],
        queueBindings: [{ exchange, routingKey: "" }],
      },
      async (msg) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Transient failure");
        }
        resolveSecondCall(msg);
      },
    );
    await consumer.ready;

    const publisher = bus.createPublisher({
      exchanges: [{ exchange, type: "fanout" }],
    });
    await publisher.send({ exchange, routingKey: "" }, { version: "4.0.0" });

    const result = await withTimeout(secondCall, 30_000);
    expect(result.version).toBe("4.0.0");
    expect(callCount).toBeGreaterThanOrEqual(2);

    await publisher.close();
    await consumer.close();
  });

  it("should deliver multiple messages to a subscriber", async () => {
    const bus = getBus();
    const exchange = "test-multi-exchange";
    const queue = "test-multi-queue";

    const receivedVersions: string[] = [];
    let resolveAll: () => void;
    const allReceived = new Promise<void>((resolve) => {
      resolveAll = resolve;
    });

    const consumer = bus.subscribe<{ version: string }>(
      {
        queue,
        exchanges: [{ exchange, type: "fanout" }],
        queueBindings: [{ exchange, routingKey: "" }],
      },
      async (msg) => {
        receivedVersions.push(msg.version);
        if (receivedVersions.length === 2) {
          resolveAll();
        }
      },
    );
    await consumer.ready;

    const publisher = bus.createPublisher({
      exchanges: [{ exchange, type: "fanout" }],
    });
    await publisher.send({ exchange, routingKey: "" }, { version: "5.0.0" });
    await publisher.send({ exchange, routingKey: "" }, { version: "6.0.0" });

    await withTimeout(allReceived);
    expect(receivedVersions).toContain("5.0.0");
    expect(receivedVersions).toContain("6.0.0");

    await publisher.close();
    await consumer.close();
  });
});
