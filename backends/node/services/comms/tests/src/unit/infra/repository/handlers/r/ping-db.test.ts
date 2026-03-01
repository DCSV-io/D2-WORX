import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { PingDb } from "@d2/comms-infra";

function createTestContext(): HandlerContext {
  const request: IRequestContext = {
    traceId: "trace-ping-db-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockDb(executeFn: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined)) {
  return { execute: executeFn } as never;
}

describe("PingDb", () => {
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecute = vi.fn().mockResolvedValue(undefined);
  });

  it("should return healthy:true with latencyMs when db.execute succeeds", async () => {
    const handler = new PingDb(createMockDb(mockExecute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(true);
    expect(result.data?.latencyMs).toBeTypeOf("number");
    expect(result.data?.error).toBeUndefined();
  });

  it("should return healthy:false with error message when db.execute throws Error", async () => {
    mockExecute.mockRejectedValue(new Error("Connection refused"));
    const handler = new PingDb(createMockDb(mockExecute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Connection refused");
  });

  it('should return healthy:false with "Unknown error" when db.execute throws non-Error', async () => {
    mockExecute.mockRejectedValue("some string error");
    const handler = new PingDb(createMockDb(mockExecute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Unknown error");
  });

  it("should return latencyMs as a non-negative integer", async () => {
    const handler = new PingDb(createMockDb(mockExecute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    const latencyMs = result.data!.latencyMs;
    expect(latencyMs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(latencyMs)).toBe(true);
  });

  it("should return D2Result.ok even on DB failure (health check never fails)", async () => {
    mockExecute.mockRejectedValue(new Error("Database crashed"));
    const handler = new PingDb(createMockDb(mockExecute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBe("Database crashed");
  });
});
