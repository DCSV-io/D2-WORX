import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startRabbitMQ, stopRabbitMQ, getBus, withTimeout } from "./rabbitmq-test-helpers.js";

describe("MessageBus integration (RabbitMQ)", () => {
  beforeAll(startRabbitMQ, 60_000);
  afterAll(stopRabbitMQ);

  it("should deliver a published message to a subscriber", async () => {
    const bus = getBus();
    const received = new Promise<{ version: string }>((resolve) => {
      bus.subscribe<{ version: string }>({ queue: "test-round-trip" }, async (msg) => {
        resolve(msg);
      });
    });

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-rt-exchange", type: "fanout" }],
    });
    await publisher.send({ exchange: "test-rt-exchange", routingKey: "" }, { version: "1.0.0" });

    const msg = await withTimeout(received);
    expect(msg.version).toBe("1.0.0");
    await publisher.close();
  });

  it("should deliver multiple messages in order", async () => {
    const bus = getBus();
    const messages: string[] = [];
    const allReceived = new Promise<void>((resolve) => {
      bus.subscribe<{ seq: string }>({ queue: "test-multi-msg", prefetchCount: 1 }, async (msg) => {
        messages.push(msg.seq);
        if (messages.length === 3) resolve();
      });
    });

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-multi-exchange", type: "fanout" }],
    });
    await publisher.send({ exchange: "test-multi-exchange", routingKey: "" }, { seq: "a" });
    await publisher.send({ exchange: "test-multi-exchange", routingKey: "" }, { seq: "b" });
    await publisher.send({ exchange: "test-multi-exchange", routingKey: "" }, { seq: "c" });

    await withTimeout(allReceived);
    expect(messages).toEqual(["a", "b", "c"]);
    await publisher.close();
  });

  it("should deliver to multiple consumers on different queues", async () => {
    const bus = getBus();
    const received1 = new Promise<{ target: string }>((resolve) => {
      bus.subscribe<{ target: string }>(
        {
          queue: "test-multi-consumer-1",
          exchanges: [{ exchange: "test-mc-exchange", type: "topic" }],
          queueBindings: [{ exchange: "test-mc-exchange", routingKey: "route.one" }],
        },
        async (msg) => {
          resolve(msg);
        },
      );
    });
    const received2 = new Promise<{ target: string }>((resolve) => {
      bus.subscribe<{ target: string }>(
        {
          queue: "test-multi-consumer-2",
          exchanges: [{ exchange: "test-mc-exchange", type: "topic" }],
          queueBindings: [{ exchange: "test-mc-exchange", routingKey: "route.two" }],
        },
        async (msg) => {
          resolve(msg);
        },
      );
    });

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-mc-exchange", type: "topic" }],
    });
    await publisher.send(
      { exchange: "test-mc-exchange", routingKey: "route.one" },
      { target: "consumer-1" },
    );
    await publisher.send(
      { exchange: "test-mc-exchange", routingKey: "route.two" },
      { target: "consumer-2" },
    );

    const [msg1, msg2] = await withTimeout(Promise.all([received1, received2]));
    expect(msg1.target).toBe("consumer-1");
    expect(msg2.target).toBe("consumer-2");
    await publisher.close();
  });

  it("should route by routing key on a topic exchange", async () => {
    const bus = getBus();
    const received = new Promise<{ data: string }>((resolve) => {
      bus.subscribe<{ data: string }>(
        {
          queue: "test-routing-key",
          exchanges: [{ exchange: "test-rk-exchange", type: "topic" }],
          queueBindings: [{ exchange: "test-rk-exchange", routingKey: "geo.updated" }],
        },
        async (msg) => {
          resolve(msg);
        },
      );
    });

    const unmatched: unknown[] = [];
    bus.subscribe(
      {
        queue: "test-routing-key-other",
        exchanges: [{ exchange: "test-rk-exchange", type: "topic" }],
        queueBindings: [{ exchange: "test-rk-exchange", routingKey: "auth.updated" }],
      },
      async (msg) => {
        unmatched.push(msg);
      },
    );

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-rk-exchange", type: "topic" }],
    });
    await publisher.send(
      { exchange: "test-rk-exchange", routingKey: "geo.updated" },
      { data: "geo-payload" },
    );

    const msg = await withTimeout(received);
    expect(msg.data).toBe("geo-payload");
    // Give a short window for the unmatched consumer — it should not receive anything
    await new Promise((r) => setTimeout(r, 500));
    expect(unmatched).toHaveLength(0);
    await publisher.close();
  });

  it("should stop receiving messages after consumer is closed", async () => {
    const bus = getBus();
    const messages: string[] = [];
    const firstReceived = new Promise<void>((resolve) => {
      bus.subscribe<{ n: string }>({ queue: "test-consumer-close" }, async (msg) => {
        messages.push(msg.n);
        resolve();
      });
    });

    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-cc-exchange", type: "fanout" }],
    });

    // Subscribe, receive one message, then close the consumer
    const consumer = bus.subscribe<{ n: string }>(
      {
        queue: "test-consumer-close-2",
        exchanges: [{ exchange: "test-cc-exchange", type: "fanout" }],
        queueBindings: [{ exchange: "test-cc-exchange", routingKey: "" }],
      },
      async (msg) => {
        messages.push("c2:" + msg.n);
      },
    );

    await publisher.send({ exchange: "test-cc-exchange", routingKey: "" }, { n: "1" });
    await withTimeout(firstReceived);
    await consumer.close();

    // Send another message — closed consumer should not receive it
    await publisher.send({ exchange: "test-cc-exchange", routingKey: "" }, { n: "2" });
    await new Promise((r) => setTimeout(r, 1000));

    // The first queue should have received both, the closed consumer should have at most the first
    const c2Messages = messages.filter((m) => m.startsWith("c2:"));
    expect(c2Messages.length).toBeLessThanOrEqual(1);
    await publisher.close();
  });

  it("should close publisher and bus without error", async () => {
    const bus = getBus();
    const publisher = bus.createPublisher({
      exchanges: [{ exchange: "test-close-exchange", type: "fanout" }],
    });
    await publisher.send(
      { exchange: "test-close-exchange", routingKey: "" },
      { msg: "before-close" },
    );

    await expect(publisher.close()).resolves.toBeUndefined();
    // bus.close() is called in afterAll — just verify a fresh publisher closes cleanly
  });
});
