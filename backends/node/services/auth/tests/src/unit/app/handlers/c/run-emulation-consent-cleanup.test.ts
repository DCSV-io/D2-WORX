import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { RunEmulationConsentCleanup, DEFAULT_AUTH_JOB_OPTIONS } from "@d2/auth-app";
import type { IPurgeExpiredEmulationConsentsHandler } from "@d2/auth-app";
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
  } as unknown as IPurgeExpiredEmulationConsentsHandler;
}

describe("RunEmulationConsentCleanup", () => {
  let acquireLock: ReturnType<typeof createMockAcquireLock>;
  let releaseLock: ReturnType<typeof createMockReleaseLock>;
  let purge: ReturnType<typeof createMockPurge>;
  let handler: RunEmulationConsentCleanup;

  beforeEach(() => {
    acquireLock = createMockAcquireLock();
    releaseLock = createMockReleaseLock();
    purge = createMockPurge();
    handler = new RunEmulationConsentCleanup(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );
  });

  it("should return lockAcquired=false when lock not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunEmulationConsentCleanup(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
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
    handler = new RunEmulationConsentCleanup(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.lockAcquired).toBe(false);
  });

  it("should purge and return rowsAffected when lock acquired", async () => {
    purge = createMockPurge(10);
    handler = new RunEmulationConsentCleanup(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(10);
    expect(result.data?.lockAcquired).toBe(true);
  });

  it("should propagate failure from purge handler", async () => {
    purge = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["DB error"] })),
    } as unknown as IPurgeExpiredEmulationConsentsHandler;
    handler = new RunEmulationConsentCleanup(
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
      handleAsync: vi.fn().mockRejectedValue(new Error("Unexpected")),
    } as unknown as IPurgeExpiredEmulationConsentsHandler;
    handler = new RunEmulationConsentCleanup(
      acquireLock,
      releaseLock,
      purge,
      DEFAULT_AUTH_JOB_OPTIONS,
      createTestContext(),
    );

    await handler.handleAsync({});

    expect(releaseLock.handleAsync).toHaveBeenCalledOnce();
  });

  it("should not release lock when lock was not acquired", async () => {
    acquireLock = createMockAcquireLock(false);
    handler = new RunEmulationConsentCleanup(
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
