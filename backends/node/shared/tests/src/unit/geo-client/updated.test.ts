import { describe, it, expect, vi } from "vitest";
import {
  HandlerContext,
  type IHandlerContext,
  type IRequestContext,
  type IHandler,
} from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, ErrorCodes } from "@d2/result";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import type { GeoRefData } from "@d2/protos";
import { Updated, type UpdatedDeps } from "@d2/geo-client";

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

describe("Updated messaging handler", () => {
  it("should return Ok when version matches current (no-op)", async () => {
    const data = createTestGeoRefData("1.0.0");
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.ok({ data: { data } })),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "1.0.0" });

    expect(result).toBeSuccess();
    // Should not fetch from dist since version matches
    expect(deps.getFromDist.handleAsync).not.toHaveBeenCalled();
  });

  it("should fetch from dist and update mem + disk when version differs", async () => {
    const oldData = createTestGeoRefData("1.0.0");
    const newData = createTestGeoRefData("2.0.0");
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.ok({ data: { data: oldData } })),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data: newData } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "2.0.0" });

    expect(result).toBeSuccess();
    expect(deps.getFromDist.handleAsync).toHaveBeenCalled();
    expect(deps.setInMem.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({ data: newData }),
    );
    expect(deps.setOnDisk.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({ data: newData }),
    );
  });

  it("should return NotFound when dist cache fails", async () => {
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.notFound()),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "1.0.0" });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
  });

  it("should continue when setInMem fails (log only)", async () => {
    const data = createTestGeoRefData("2.0.0");
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      setInMem: createMockHandler(async () => D2Result.fail({ messages: ["Cache error"] })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "2.0.0" });

    // Should still succeed
    expect(result).toBeSuccess();
    expect(deps.setOnDisk.handleAsync).toHaveBeenCalled();
  });

  it("should continue when setOnDisk fails (log only)", async () => {
    const data = createTestGeoRefData("2.0.0");
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.fail({ messages: ["Disk error"] })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "2.0.0" });

    // Should still succeed
    expect(result).toBeSuccess();
  });

  it("should fetch from dist when get handler returns NotFound", async () => {
    const data = createTestGeoRefData("1.0.0");
    const deps: UpdatedDeps = {
      getHandler: createMockHandler(async () => D2Result.notFound()),
      getFromDist: createMockHandler(async () => D2Result.ok({ data: { data } })),
      setInMem: createMockHandler(async () => D2Result.ok({ data: {} })),
      setOnDisk: createMockHandler(async () => D2Result.ok({ data: {} })),
    };

    const handler = new Updated(deps, createTestContext());
    const result = await handler.handleAsync({ version: "1.0.0" });

    expect(result).toBeSuccess();
    expect(deps.getFromDist.handleAsync).toHaveBeenCalled();
  });
});
