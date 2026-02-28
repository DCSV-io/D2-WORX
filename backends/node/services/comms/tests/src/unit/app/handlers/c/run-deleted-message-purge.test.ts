import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { RunDeletedMessagePurge, DEFAULT_COMMS_JOB_OPTIONS } from "@d2/comms-app";
import type { IPurgeDeletedMessagesHandler } from "@d2/comms-app";
import type { DistributedCache } from "@d2/interfaces";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockAcquireLock(acquired = true) {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { acquired } })),
  } as unknown as DistributedCache.IAcquireLockHandler;
}

function createMockReleaseLock() {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { released: true } })),
  } as unknown as DistributedCache.IReleaseLockHandler;
}

function createMockPurge(rowsAffected = 0) {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { rowsAffected } })),
  } as unknown as IPurgeDeletedMessagesHandler;
}

describe("RunDeletedMessagePurge", () => {
  let acquireLock: ReturnType<typeof createMockAcquireLock>;
  let releaseLock: ReturnType<typeof createMockReleaseLock>;
  let purge: ReturnType<typeof createMockPurge>;
  let handler: RunDeletedMessagePurge;

  beforeEach(() => {
    acquireLock = createMockAcquireLock();
    releaseLock = createMockReleaseLock();
    purge = createMockPurge();
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );
  });

  it("should return lockAcquired=false when lock not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(false);
    expect(purge.handleAsync).not.toHaveBeenCalled();
  });

  it("should return lockAcquired=false when lock acquire fails", async () => {
    acquireLock = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Redis down"] })),
    } as unknown as DistributedCache.IAcquireLockHandler;
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(false);
  });

  it("should purge with correct cutoff date based on deletedMessageRetentionDays", async () => {
    const before = new Date();
    before.setDate(before.getDate() - DEFAULT_COMMS_JOB_OPTIONS.deletedMessageRetentionDays);

    await handler.handleAsync({});

    const purgeCall = (purge.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cutoff = purgeCall.cutoffDate as Date;
    expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(5000);
  });

  it("should return correct rowsAffected", async () => {
    purge = createMockPurge(75);
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(75);
    expect(result.data?.lockAcquired).toBe(true);
  });

  it("should propagate failure from purge handler", async () => {
    purge = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["DB error"] })),
    } as unknown as IPurgeDeletedMessagesHandler;
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(false);
  });

  it("should always release lock even when purge throws", async () => {
    purge = {
      handleAsync: vi.fn().mockRejectedValue(new Error("Unexpected")),
    } as unknown as IPurgeDeletedMessagesHandler;
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    await handler.handleAsync({});

    expect(releaseLock.handleAsync).toHaveBeenCalledOnce();
  });

  it("should not release lock when lock was not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_COMMS_JOB_OPTIONS,
      createTestContext(),
    );

    await handler.handleAsync({});

    expect(releaseLock.handleAsync).not.toHaveBeenCalled();
  });

  it("should use custom retention days from options", async () => {
    const customOptions = { ...DEFAULT_COMMS_JOB_OPTIONS, deletedMessageRetentionDays: 30 };
    handler = new RunDeletedMessagePurge(
      acquireLock,
      releaseLock,
      purge,
      customOptions,
      createTestContext(),
    );

    const before = new Date();
    before.setDate(before.getDate() - 30);

    await handler.handleAsync({});

    const purgeCall = (purge.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const cutoff = purgeCall.cutoffDate as Date;
    expect(Math.abs(cutoff.getTime() - before.getTime())).toBeLessThan(5000);
  });

  it("should report positive durationMs", async () => {
    const result = await handler.handleAsync({});

    expect(result.data?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
