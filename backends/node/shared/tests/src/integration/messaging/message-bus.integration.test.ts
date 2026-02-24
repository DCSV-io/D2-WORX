import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConsumerResult } from "@d2/messaging";
import {
  startRabbitMQ,
  stopRabbitMQ,
  getBus,
  createFreshBus,
  withTimeout,
} from "./rabbitmq-test-helpers.js";

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

  describe("subscribeEnriched", () => {
    it("should deliver message with AMQP headers to enriched handler", async () => {
      const bus = getBus();
      const exchange = "test-enriched-exchange";
      const queue = "test-enriched-queue";

      let resolveReceived: (msg: unknown) => void;
      const received = new Promise<unknown>((resolve) => {
        resolveReceived = resolve;
      });

      const consumer = bus.subscribeEnriched<{ data: string }>(
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
      await publisher.send(
        {
          exchange,
          routingKey: "",
          headers: { "x-custom-header": "test-value" },
          messageId: "msg-enriched-1",
        },
        { data: "enriched-payload" },
      );

      const msg = (await withTimeout(received)) as {
        body: { data: string };
        headers: Record<string, unknown>;
        messageId: string;
        redelivered: boolean;
      };

      expect(msg.body.data).toBe("enriched-payload");
      expect(msg.headers["x-custom-header"]).toBe("test-value");
      expect(msg.messageId).toBe("msg-enriched-1");
      expect(msg.redelivered).toBe(false);

      await publisher.close();
      await consumer.close();
    });

    it("should respect ConsumerResult.ACK from handler", async () => {
      const bus = getBus();
      const exchange = "test-enriched-ack-exchange";
      const queue = "test-enriched-ack-queue";

      let callCount = 0;
      let resolveReceived: () => void;
      const received = new Promise<void>((resolve) => {
        resolveReceived = resolve;
      });

      const consumer = bus.subscribeEnriched<{ data: string }>(
        {
          queue,
          exchanges: [{ exchange, type: "fanout" }],
          queueBindings: [{ exchange, routingKey: "" }],
        },
        async () => {
          callCount++;
          resolveReceived();
          return ConsumerResult.ACK;
        },
      );
      await consumer.ready;

      const publisher = bus.createPublisher({
        exchanges: [{ exchange, type: "fanout" }],
      });
      await publisher.send({ exchange, routingKey: "" }, { data: "ack-test" });

      await withTimeout(received);
      // Wait a bit to ensure no redelivery
      await new Promise((r) => setTimeout(r, 1000));
      expect(callCount).toBe(1);

      await publisher.close();
      await consumer.close();
    });
  });

  describe("declareTopology", () => {
    // Use a fresh MessageBus for topology tests to avoid shared channel state
    // pollution from earlier subscribe/publish tests (rabbitmq-client's internal
    // lazy channel can become unusable after heavy consumer/publisher churn).
    let topoBus: ReturnType<typeof getBus>;

    beforeAll(async () => {
      topoBus = await createFreshBus();
    }, 30_000);

    afterAll(async () => {
      await topoBus?.close();
    });

    it("should declare exchanges, queues, and bindings", async () => {
      // Should not throw
      await topoBus.declareTopology({
        exchanges: [{ exchange: "test-topo-exchange", type: "direct", durable: true }],
        queues: [{ queue: "test-topo-queue", durable: true }],
        bindings: [
          {
            exchange: "test-topo-exchange",
            queue: "test-topo-queue",
            routingKey: "test-key",
          },
        ],
      });

      // Verify the topology works by publishing through it
      let resolveReceived: (msg: { ok: boolean }) => void;
      const received = new Promise<{ ok: boolean }>((resolve) => {
        resolveReceived = resolve;
      });

      // queueOptions must match declareTopology (durable: true) to avoid
      // PRECONDITION_FAILED from re-declaring with different properties.
      const consumer = topoBus.subscribe<{ ok: boolean }>(
        { queue: "test-topo-queue", queueOptions: { durable: true } },
        async (msg) => {
          resolveReceived(msg);
        },
      );
      await consumer.ready;

      const publisher = topoBus.createPublisher();
      await publisher.send(
        { exchange: "test-topo-exchange", routingKey: "test-key" },
        { ok: true },
      );

      const result = await withTimeout(received);
      expect(result.ok).toBe(true);

      await publisher.close();
      await consumer.close();
    });

    it("should support DLX queue with TTL that dead-letters to another queue", async () => {
      // Set up: DLX queue → requeue exchange → destination queue
      await topoBus.declareTopology({
        exchanges: [{ exchange: "test-dlx-requeue", type: "direct", durable: true }],
        queues: [
          {
            queue: "test-dlx-tier",
            durable: true,
            arguments: {
              "x-message-ttl": 1000, // 1 second TTL
              "x-dead-letter-exchange": "test-dlx-requeue",
              "x-dead-letter-routing-key": "test-dlx-dest",
            },
          },
          { queue: "test-dlx-dest", durable: true },
        ],
        bindings: [
          {
            exchange: "test-dlx-requeue",
            queue: "test-dlx-dest",
            routingKey: "test-dlx-dest",
          },
        ],
      });

      // Subscribe to the destination queue — durable must match declareTopology
      let resolveReceived: (msg: { ping: string }) => void;
      const received = new Promise<{ ping: string }>((resolve) => {
        resolveReceived = resolve;
      });

      const consumer = topoBus.subscribe<{ ping: string }>(
        { queue: "test-dlx-dest", queueOptions: { durable: true } },
        async (msg) => {
          resolveReceived(msg);
        },
      );
      await consumer.ready;

      // Publish directly to the tier queue (no consumer — TTL will expire and DLX)
      const publisher = topoBus.createPublisher();
      await publisher.send(
        { exchange: "", routingKey: "test-dlx-tier" },
        { ping: "dlx-test" },
      );

      // Wait for TTL expiry + DLX routing (1s TTL + buffer)
      const result = await withTimeout(received, 10_000);
      expect(result.ping).toBe("dlx-test");

      await publisher.close();
      await consumer.close();
    });
  });
});
