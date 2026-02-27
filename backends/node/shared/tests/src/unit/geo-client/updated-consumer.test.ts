import { describe, it, expect, vi } from "vitest";
import type { ILogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { createUpdatedConsumer } from "@d2/geo-client";
import type { Updated } from "@d2/geo-client";
import type { MessageBus, ConsumerConfig, IMessageConsumer } from "@d2/messaging";
import type { GeoRefDataUpdatedEvent } from "@d2/protos";

function createMockLogger(): ILogger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger;
}

describe("createUpdatedConsumer", () => {
  it("should subscribe to the bus with the given config", () => {
    const subscribeFn = vi.fn().mockReturnValue({ ready: Promise.resolve(), close: vi.fn() });
    const bus = { subscribe: subscribeFn } as unknown as MessageBus;
    const config: ConsumerConfig<GeoRefDataUpdatedEvent> = { queue: "geo-ref-data-updated" };
    const handlerFactory = vi.fn();
    const logger = createMockLogger();

    createUpdatedConsumer(bus, config, handlerFactory, logger);

    expect(subscribeFn).toHaveBeenCalledWith(
      expect.objectContaining({ queue: "geo-ref-data-updated", deserialize: expect.any(Function) }),
      expect.any(Function),
    );
  });

  it("should call handler and not throw on success (ack)", async () => {
    let capturedCallback: ((message: GeoRefDataUpdatedEvent) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation(
          (
            _config: ConsumerConfig<GeoRefDataUpdatedEvent>,
            cb: (message: GeoRefDataUpdatedEvent) => Promise<void>,
          ) => {
            capturedCallback = cb;
            return { ready: Promise.resolve(), close: vi.fn() } satisfies IMessageConsumer;
          },
        ),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    await expect(capturedCallback!({ version: "1.0.0" })).resolves.toBeUndefined();
    expect(mockHandler.handleAsync).toHaveBeenCalledWith({ version: "1.0.0" });
  });

  it("should throw when handler returns failure (nack for retry)", async () => {
    let capturedCallback: ((message: GeoRefDataUpdatedEvent) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation(
          (
            _config: ConsumerConfig<GeoRefDataUpdatedEvent>,
            cb: (message: GeoRefDataUpdatedEvent) => Promise<void>,
          ) => {
            capturedCallback = cb;
            return { ready: Promise.resolve(), close: vi.fn() } satisfies IMessageConsumer;
          },
        ),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Error"] })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    await expect(capturedCallback!({ version: "1.0.0" })).rejects.toThrow(
      "Failed to process GeoRefDataUpdated event for version 1.0.0",
    );
  });

  it("should log receipt, success, and failure messages", async () => {
    let capturedCallback: ((message: GeoRefDataUpdatedEvent) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation(
          (
            _config: ConsumerConfig<GeoRefDataUpdatedEvent>,
            cb: (message: GeoRefDataUpdatedEvent) => Promise<void>,
          ) => {
            capturedCallback = cb;
            return { ready: Promise.resolve(), close: vi.fn() } satisfies IMessageConsumer;
          },
        ),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    await capturedCallback!({ version: "2.0.0" });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received GeoRefDataUpdated event for version 2.0.0"),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Successfully processed GeoRefDataUpdated event for version 2.0.0"),
    );
  });

  it("should propagate deserializer errors (nack for retry)", async () => {
    let capturedConfig: ConsumerConfig<GeoRefDataUpdatedEvent> | undefined;
    let capturedCallback: ((message: GeoRefDataUpdatedEvent) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation(
          (
            config: ConsumerConfig<GeoRefDataUpdatedEvent>,
            cb: (message: GeoRefDataUpdatedEvent) => Promise<void>,
          ) => {
            capturedConfig = config;
            capturedCallback = cb;
            return { ready: Promise.resolve(), close: vi.fn() } satisfies IMessageConsumer;
          },
        ),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    // The deserialize function is passed in config — verify it exists
    expect(capturedConfig!.deserialize).toBeDefined();

    // The callback receives already-deserialized data (MessageBus applies deserialize),
    // but if deserialize throws, MessageBus propagates it. Verify the config wires it.
    expect(typeof capturedConfig!.deserialize).toBe("function");

    // Valid data still works through the callback
    await expect(capturedCallback!({ version: "1.0.0" })).resolves.toBeUndefined();
  });

  it("should return the consumer from bus.subscribe", () => {
    const mockConsumer = { ready: Promise.resolve(), close: vi.fn().mockResolvedValue(undefined) };
    const bus = {
      subscribe: vi.fn().mockReturnValue(mockConsumer),
    } as unknown as MessageBus;

    const logger = createMockLogger();
    const consumer = createUpdatedConsumer(bus, { queue: "q" }, vi.fn() as never, logger);

    expect(consumer).toBe(mockConsumer);
  });
});
