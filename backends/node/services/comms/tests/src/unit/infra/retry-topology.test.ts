import { describe, it, expect, vi } from "vitest";
import { declareRetryTopology, getRetryTierQueue } from "@d2/comms-infra";

describe("getRetryTierQueue", () => {
  it("should map retryCount 0 to tier-1", () => {
    expect(getRetryTierQueue(0)).toBe("comms.retry.tier-1");
  });

  it("should map retryCount 1 to tier-2", () => {
    expect(getRetryTierQueue(1)).toBe("comms.retry.tier-2");
  });

  it("should map retryCount 2 to tier-3", () => {
    expect(getRetryTierQueue(2)).toBe("comms.retry.tier-3");
  });

  it("should map retryCount 3 to tier-4", () => {
    expect(getRetryTierQueue(3)).toBe("comms.retry.tier-4");
  });

  it("should map retryCount 4 to tier-5", () => {
    expect(getRetryTierQueue(4)).toBe("comms.retry.tier-5");
  });

  it("should cap at tier-5 for retryCount 5+", () => {
    expect(getRetryTierQueue(5)).toBe("comms.retry.tier-5");
    expect(getRetryTierQueue(6)).toBe("comms.retry.tier-5");
    expect(getRetryTierQueue(8)).toBe("comms.retry.tier-5");
    expect(getRetryTierQueue(9)).toBe("comms.retry.tier-5");
  });

  it("should return null when max attempts (10) reached", () => {
    expect(getRetryTierQueue(10)).toBeNull();
  });

  it("should return null for counts beyond max attempts", () => {
    expect(getRetryTierQueue(11)).toBeNull();
    expect(getRetryTierQueue(100)).toBeNull();
  });
});

describe("declareRetryTopology", () => {
  function createMockMessageBus() {
    return {
      declareTopology: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("should declare the requeue exchange", async () => {
    const bus = createMockMessageBus();

    await declareRetryTopology(bus as never);

    const config = bus.declareTopology.mock.calls[0][0];
    expect(config.exchanges).toEqual([
      { exchange: "comms.retry.requeue", type: "direct", durable: true },
    ]);
  });

  it("should declare main queue + 5 tier queues with escalating TTLs", async () => {
    const bus = createMockMessageBus();

    await declareRetryTopology(bus as never);

    const config = bus.declareTopology.mock.calls[0][0];
    // 1 main queue + 5 tier queues
    expect(config.queues).toHaveLength(6);

    // First queue is the main consumer queue (must exist before binding)
    expect(config.queues[0]).toEqual({
      queue: "comms.notifications",
      durable: true,
    });

    const expectedTtls = [5_000, 10_000, 30_000, 60_000, 300_000];
    for (let i = 0; i < 5; i++) {
      expect(config.queues[i + 1]).toEqual({
        queue: `comms.retry.tier-${i + 1}`,
        durable: true,
        arguments: {
          "x-message-ttl": expectedTtls[i],
          "x-dead-letter-exchange": "comms.retry.requeue",
          "x-dead-letter-routing-key": "comms.notifications",
        },
      });
    }
  });

  it("should bind requeue exchange to main consumer queue", async () => {
    const bus = createMockMessageBus();

    await declareRetryTopology(bus as never);

    const config = bus.declareTopology.mock.calls[0][0];
    expect(config.bindings).toEqual([
      {
        exchange: "comms.retry.requeue",
        queue: "comms.notifications",
        routingKey: "comms.notifications",
      },
    ]);
  });

  it("should call declareTopology exactly once", async () => {
    const bus = createMockMessageBus();

    await declareRetryTopology(bus as never);

    expect(bus.declareTopology).toHaveBeenCalledOnce();
  });
});
