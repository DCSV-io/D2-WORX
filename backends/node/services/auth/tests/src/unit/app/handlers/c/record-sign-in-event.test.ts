import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
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
      userId: "user-123",
      successful: true,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      whoIsId: "whois-456",
    });

    expect(result.success).toBe(true);
    expect(result.data?.event).toBeDefined();
    expect(result.data?.event.userId).toBe("user-123");
    expect(result.data?.event.successful).toBe(true);
    expect(result.data?.event.ipAddress).toBe("192.168.1.1");
    expect(result.data?.event.userAgent).toBe("Mozilla/5.0");
    expect(result.data?.event.whoIsId).toBe("whois-456");
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("should set whoIsId to null when not provided", async () => {
    const result = await handler.handleAsync({
      userId: "user-123",
      successful: false,
      ipAddress: "10.0.0.1",
      userAgent: "curl/7.0",
    });

    expect(result.success).toBe(true);
    expect(result.data?.event.whoIsId).toBeNull();
  });

  it("should generate a UUIDv7 id for the event", async () => {
    const result = await handler.handleAsync({
      userId: "user-123",
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
      userId: "user-789",
      successful: true,
      ipAddress: "172.16.0.1",
      userAgent: "Bot/1.0",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-789",
        ipAddress: "172.16.0.1",
      }),
    );
  });
});
