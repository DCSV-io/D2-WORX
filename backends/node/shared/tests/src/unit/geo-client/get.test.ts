import { describe, it, expect, vi } from "vitest";
import {
  HandlerContext,
  type IHandlerContext,
  type IRequestContext,
  type IHandler,
} from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import type { GeoRefData } from "@d2/protos";
import { Get, type GetDeps } from "@d2/geo-client";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createTestGeoRefData(version = "1.0.0"): GeoRefData {
  return GeoRefDataCodec.fromPartial({ version });
}

function createMockHandler<TInput, TOutput>(
  impl: (input: TInput) => Promise<D2Result<TOutput | undefined>>,
): IHandler<TInput, TOutput> {
  return { handleAsync: vi.fn(impl) };
}

describe("Get orchestrator handler", () => {
  it("should return immediately on memory cache hit", async () => {
    const data = createTestGeoRefData();
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.ok({ data: { data } })),
      getFromDist: createMockHandler(async () => D2Result.notFound()),
      getFromDisk: createMockHandler(async () => D2Result.notFound()),
      reqUpdate: createMockHandler(async () => D2Result.ok({ data: { version: "1.0.0" } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Get(deps, createTestContext());
    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.data.version).toBe("1.0.0");
    expect(deps.getFromDist.handleAsync).not.toHaveBeenCalled();
  });

  it("should fall back to dist cache and populate memory + disk", async () => {
    const data = createTestGeoRefData("2.0.0");
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      getFromDisk: createMockHandler(async () => D2Result.notFound()),
      reqUpdate: createMockHandler(async () => D2Result.ok({ data: { version: "2.0.0" } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Get(deps, createTestContext());
    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.data.version).toBe("2.0.0");
    expect(deps.setInMem.handleAsync).toHaveBeenCalledWith(expect.objectContaining({ data }));
    expect(deps.setOnDisk.handleAsync).toHaveBeenCalledWith(expect.objectContaining({ data }));
  });

  it("should fall back to disk and populate memory when dist fails", async () => {
    const data = createTestGeoRefData("3.0.0");
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.notFound()),
      getFromDisk: createMockHandler(async () => D2Result.ok({ data: { data } })),
      reqUpdate: createMockHandler(async () => D2Result.ok({ data: { version: "3.0.0" } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Get(deps, createTestContext());
    const result = await handler.handleAsync({});

    expect(result).toBeSuccess();
    expect(result.data?.data.version).toBe("3.0.0");
    expect(deps.setInMem.handleAsync).toHaveBeenCalled();
  });

  it("should log error when setInMem fails but continue", async () => {
    const data = createTestGeoRefData();
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      getFromDisk: createMockHandler(async () => D2Result.notFound()),
      reqUpdate: createMockHandler(async () => D2Result.ok({ data: { version: "1.0.0" } })),
      setInMem: createMockHandler(async () => D2Result.fail({ messages: ["Cache error"] })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Get(deps, createTestContext());
    const result = await handler.handleAsync({});

    // Should still succeed — cache write failure is not fatal
    expect(result).toBeSuccess();
    expect(result.data?.data.version).toBe("1.0.0");
  });

  it("should return NotFound after all retry attempts fail", async () => {
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.notFound()),
      getFromDisk: createMockHandler(async () => D2Result.notFound()),
      reqUpdate: createMockHandler(async () => D2Result.fail()),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    // Override timeout to make test fast — stub setTimeout
    vi.useFakeTimers();
    const handler = new Get(deps, createTestContext());
    const resultPromise = handler.handleAsync({});

    // Advance through all 5 delays (1s, 2s, 4s, 8s, 16s)
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
    }

    const result = await resultPromise;
    vi.useRealTimers();

    expect(result).toBeFailure();
    // 6 attempts = 6 calls to getFromMem
    expect(deps.getFromMem.handleAsync).toHaveBeenCalledTimes(6);
  });

  it("should log error when reqUpdate fails", async () => {
    const data = createTestGeoRefData();
    const deps: GetDeps = {
      getFromMem: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.notFound()),
      // Disk returns data on first attempt so no retries needed
      getFromDisk: createMockHandler(async () => D2Result.ok({ data: { data } })),
      reqUpdate: createMockHandler(async () => D2Result.fail({ messages: ["Unavailable"] })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Get(deps, createTestContext());
    const result = await handler.handleAsync({});

    // Still succeeds via disk fallback even though reqUpdate failed
    expect(result).toBeSuccess();
  });
});
