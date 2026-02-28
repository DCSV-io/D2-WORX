import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { RunSessionPurge, DEFAULT_AUTH_JOB_OPTIONS } from "@d2/auth-app";
import type { IPurgeExpiredSessionsHandler } from "@d2/auth-app";
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
  } as unknown as IPurgeExpiredSessionsHandler;
}

describe("RunSessionPurge", () => {
  let acquireLock: ReturnType<typeof createMockAcquireLock>;
  let releaseLock: ReturnType<typeof createMockReleaseLock>;
  let purge: ReturnType<typeof createMockPurge>;
  let handler: RunSessionPurge;

  beforeEach(() => {
    acquireLock = createMockAcquireLock();
    releaseLock = createMockReleaseLock();
    purge = createMockPurge();
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );
  });

  it("should return lockAcquired=false when lock is not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(false);
    expect(result.data?.rowsAffected).toBe(0);
    expect(purge.handleAsync).not.toHaveBeenCalled();
    expect(releaseLock.handleAsync).not.toHaveBeenCalled();
  });

  it("should return lockAcquired=false when lock acquire fails (Redis error)", async () => {
    acquireLock = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Redis down"] })),
    } as unknown as DistributedCache.IAcquireLockHandler;
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(false);
    expect(result.data?.rowsAffected).toBe(0);
    expect(purge.handleAsync).not.toHaveBeenCalled();
  });

  it("should purge and return rowsAffected when lock acquired (0 rows)", async () => {
    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(true);
    expect(result.data?.rowsAffected).toBe(0);
    expect(purge.handleAsync).toHaveBeenCalledOnce();
  });

  it("should return correct rowsAffected when purge deletes rows", async () => {
    purge = createMockPurge(42);
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(42);
    expect(result.data?.lockAcquired).toBe(true);
  });

  it("should propagate failure when purge fails", async () => {
    purge = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(D2Result.fail({ messages: ["Purge failed"], statusCode: 500 })),
    } as unknown as IPurgeExpiredSessionsHandler;
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(false);
  });

  it("should always release lock even when purge throws", async () => {
    purge = {
      handleAsync: vi.fn().mockRejectedValue(new Error("Unexpected DB error")),
    } as unknown as IPurgeExpiredSessionsHandler;
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    // BaseHandler wraps exceptions — the result should be a failure
    const result = await handler.handleAsync({});

    expect(result.success).toBe(false);
    expect(releaseLock.handleAsync).toHaveBeenCalledOnce();
  });

  it("should always release lock after successful purge", async () => {
    await handler.handleAsync({});

    expect(releaseLock.handleAsync).toHaveBeenCalledOnce();
  });

  it("should pass lockTtlMs from options to acquireLock", async () => {
    await handler.handleAsync({});

    const lockCall = (acquireLock.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(lockCall.expirationMs).toBe(DEFAULT_AUTH_JOB_OPTIONS.lockTtlMs);
  });

  it("should not release lock when lock was not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunSessionPurge(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    await handler.handleAsync({});

    expect(releaseLock.handleAsync).not.toHaveBeenCalled();
  });

  it("should report positive durationMs", async () => {
    const result = await handler.handleAsync({});

    expect(result.data?.durationMs).toBeGreaterThanOrEqual(0);
  });
});
