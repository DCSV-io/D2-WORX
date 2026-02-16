import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode } from "@d2/result";
import { RecordSignInEvent } from "@d2/auth-app";
import type { ISignInEventRepository } from "@d2/auth-app";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: true,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockRepo(): ISignInEventRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findByUserId: vi.fn().mockResolvedValue([]),
    countByUserId: vi.fn().mockResolvedValue(0),
  };
}

describe("RecordSignInEvent", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let handler: RecordSignInEvent;

  beforeEach(() => {
    repo = createMockRepo();
    handler = new RecordSignInEvent(repo, createTestContext());
  });

  it("should record a sign-in event and return success", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: true,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      whoIsId: "abcdef0123456789abcdef0123456789",
    });

    expect(result.success).toBe(true);
    expect(result.data?.event).toBeDefined();
    expect(result.data?.event.userId).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(result.data?.event.successful).toBe(true);
    expect(result.data?.event.ipAddress).toBe("192.168.1.1");
    expect(result.data?.event.userAgent).toBe("Mozilla/5.0");
    expect(result.data?.event.whoIsId).toBe("abcdef0123456789abcdef0123456789");
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("should set whoIsId to null when not provided", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: false,
      ipAddress: "10.0.0.1",
      userAgent: "curl/7.0",
    });

    expect(result.success).toBe(true);
    expect(result.data?.event.whoIsId).toBeNull();
  });

  it("should generate a UUIDv7 id for the event", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: true,
      ipAddress: "10.0.0.1",
      userAgent: "TestAgent",
    });

    expect(result.success).toBe(true);
    expect(result.data?.event.id).toBeDefined();
    expect(result.data?.event.id.length).toBeGreaterThan(0);
  });

  it("should pass the domain event to the repository", async () => {
    await handler.handleAsync({
      userId: "abcdef01-2345-6789-abcd-ef0123456789",
      successful: true,
      ipAddress: "172.16.0.1",
      userAgent: "Bot/1.0",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "abcdef01-2345-6789-abcd-ef0123456789",
        ipAddress: "172.16.0.1",
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Zod validation tests (gap #6)
  // -----------------------------------------------------------------------

  it("should return validationFailed when userId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      userId: "not-a-uuid",
      successful: true,
      ipAddress: "10.0.0.1",
      userAgent: "TestAgent",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return validationFailed when ipAddress exceeds 45 characters", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: true,
      ipAddress: "x".repeat(46),
      userAgent: "TestAgent",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return validationFailed when userAgent exceeds 512 characters", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: true,
      ipAddress: "10.0.0.1",
      userAgent: "x".repeat(513),
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should accept valid input at max field lengths", async () => {
    const result = await handler.handleAsync({
      userId: "01234567-89ab-cdef-0123-456789abcdef",
      successful: false,
      ipAddress: "x".repeat(45),
      userAgent: "x".repeat(512),
      whoIsId: "x".repeat(64),
    });

    expect(result.success).toBe(true);
    expect(repo.create).toHaveBeenCalledOnce();
  });
});
