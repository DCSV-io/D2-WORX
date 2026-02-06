import { describe, it, expect, vi } from "vitest";
import type { ILogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { createUpdatedConsumer } from "@d2/geo-client";
import type { Updated } from "@d2/geo-client";
import type { MessageBus, ConsumerConfig, IMessageConsumer } from "@d2/messaging";

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
    const subscribeFn = vi.fn().mockReturnValue({ close: vi.fn() });
    const bus = { subscribe: subscribeFn } as unknown as MessageBus;
    const config: ConsumerConfig = { queue: "geo-ref-data-updated" };
    const handlerFactory = vi.fn();
    const logger = createMockLogger();

    createUpdatedConsumer(bus, config, handlerFactory, logger);

    expect(subscribeFn).toHaveBeenCalledWith(config, expect.any(Function));
  });

  it("should call handler and not throw on success (ack)", async () => {
    let capturedCallback: ((message: unknown) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation((_config: ConsumerConfig, cb: (message: unknown) => Promise<void>) => {
          capturedCallback = cb;
          return { close: vi.fn() } satisfies IMessageConsumer;
        }),
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
    let capturedCallback: ((message: unknown) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation((_config: ConsumerConfig, cb: (message: unknown) => Promise<void>) => {
          capturedCallback = cb;
          return { close: vi.fn() } satisfies IMessageConsumer;
        }),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Error"] })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    await expect(capturedCallback!({ version: "1.0.0" })).rejects.toThrow(
      "Failed to process GeoRefDataUpdated message for version 1.0.0",
    );
  });

  it("should log receipt, success, and failure messages", async () => {
    let capturedCallback: ((message: unknown) => Promise<void>) | undefined;
    const bus = {
      subscribe: vi
        .fn()
        .mockImplementation((_config: ConsumerConfig, cb: (message: unknown) => Promise<void>) => {
          capturedCallback = cb;
          return { close: vi.fn() } satisfies IMessageConsumer;
        }),
    } as unknown as MessageBus;

    const mockHandler = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    } as unknown as Updated;

    const logger = createMockLogger();
    createUpdatedConsumer(bus, { queue: "q" }, () => mockHandler, logger);

    await capturedCallback!({ version: "2.0.0" });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Received GeoRefDataUpdated message for version 2.0.0"),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Successfully processed GeoRefDataUpdated message for version 2.0.0"),
    );
  });

  it("should return the consumer from bus.subscribe", () => {
    const mockConsumer = { close: vi.fn().mockResolvedValue(undefined) };
    const bus = {
      subscribe: vi.fn().mockReturnValue(mockConsumer),
    } as unknown as MessageBus;

    const logger = createMockLogger();
    const consumer = createUpdatedConsumer(bus, { queue: "q" }, vi.fn() as never, logger);

    expect(consumer).toBe(mockConsumer);
  });
});
