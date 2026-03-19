import { describe, it, expect, vi } from "vitest";
import { PingDb } from "@d2/files-infra";
import { createTestContext } from "../../helpers/test-context.js";

function createMockDb(executeFn: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined)) {
  return { execute: executeFn } as never;
}

describe("PingDb", () => {
  it("should return healthy:true with latencyMs when db.execute succeeds", async () => {
    const handler = new PingDb(createMockDb(), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(true);
    expect(result.data?.latencyMs).toBeTypeOf("number");
    expect(result.data?.error).toBeUndefined();
  });

  it("should return healthy:false with error message when db.execute throws Error", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("Connection refused"));
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("Connection refused");
  });

  it("should return healthy:false with stringified error when non-Error thrown", async () => {
    const execute = vi.fn().mockRejectedValue("some string error");
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("some string error");
  });

  it("should return latencyMs as a non-negative integer", async () => {
    const handler = new PingDb(createMockDb(), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    const latencyMs = result.data!.latencyMs;
    expect(latencyMs).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(latencyMs)).toBe(true);
  });

  it("should return D2Result.ok even on DB failure (health check never fails)", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("Database crashed"));
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.data?.error).toBe("Database crashed");
  });

  it("should return latencyMs on failure path too", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("timeout"));
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.latencyMs).toBeTypeOf("number");
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should call db.execute exactly once", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const handler = new PingDb(createMockDb(execute), createTestContext());

    await handler.handleAsync({});

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("should handle undefined thrown as error", async () => {
    const execute = vi.fn().mockRejectedValue(undefined);
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("undefined");
  });

  it("should handle null thrown as error", async () => {
    const execute = vi.fn().mockRejectedValue(null);
    const handler = new PingDb(createMockDb(execute), createTestContext());

    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.healthy).toBe(false);
    expect(result.data?.error).toBe("null");
  });
});
