import { describe, it, expect, vi, beforeEach } from "vitest";
import * as grpc from "@grpc/grpc-js";
import { ServiceCollection, type ServiceProvider, createServiceKey } from "@d2/di";
import { D2Result } from "@d2/result";
import { handleJobRpc, type JobRpcOutput } from "@d2/service-defaults/grpc";
import { ILoggerKey, type ILogger } from "@d2/logging";
import type { TriggerJobRequest, TriggerJobResponse } from "@d2/protos";

// --------------- Helpers ---------------

interface TestJobOutput extends JobRpcOutput {
  readonly rowsAffected: number;
  readonly durationMs: number;
  readonly lockAcquired: boolean;
}

const ITestJobHandlerKey = createServiceKey<{
  handleAsync(
    input: Record<string, never>,
  ): Promise<D2Result<TestJobOutput | undefined>>;
}>("ITestJobHandler");

function createMockCall(): grpc.ServerUnaryCall<TriggerJobRequest, TriggerJobResponse> {
  return {
    request: {},
    metadata: new grpc.Metadata(),
    getPeer: () => "127.0.0.1",
  } as unknown as grpc.ServerUnaryCall<TriggerJobRequest, TriggerJobResponse>;
}

function createProvider(handler: {
  handleAsync(
    input: Record<string, never>,
  ): Promise<D2Result<TestJobOutput | undefined>>;
}): ServiceProvider {
  const services = new ServiceCollection();

  const stubLogger: ILogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as ILogger;
  services.addSingleton(ILoggerKey, () => stubLogger);
  services.addScoped(ITestJobHandlerKey, () => handler);

  return services.build();
}

// --------------- Tests ---------------

describe("handleJobRpc", () => {
  let handlerMock: { handleAsync: ReturnType<typeof vi.fn> };
  let provider: ServiceProvider;

  beforeEach(() => {
    handlerMock = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.ok<TestJobOutput>({
          data: { rowsAffected: 42, durationMs: 150, lockAcquired: true },
        }),
      ),
    };
    provider = createProvider(handlerMock);
  });

  it("should map success result to TriggerJobResponse with JobExecutionData", async () => {
    const call = createMockCall();
    const callback = vi.fn();

    handleJobRpc(provider, call, callback, ITestJobHandlerKey, "test-job");

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    const [err, response] = callback.mock.calls[0];
    expect(err).toBeNull();
    expect(response.data.jobName).toBe("test-job");
    expect(response.data.rowsAffected).toBe(42);
    expect(response.data.durationMs).toBe("150");
    expect(response.data.lockAcquired).toBe(true);
    expect(response.data.executedAt).toBeDefined();
  });

  it("should pass empty object as handler input", async () => {
    const call = createMockCall();
    const callback = vi.fn();

    handleJobRpc(provider, call, callback, ITestJobHandlerKey, "test-job");

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(handlerMock.handleAsync).toHaveBeenCalledWith({});
  });

  it("should default Data fields to zero/false when handler returns failure", async () => {
    handlerMock.handleAsync.mockResolvedValue(
      D2Result.fail<TestJobOutput>({ messages: ["lock timeout"] }),
    );
    const call = createMockCall();
    const callback = vi.fn();

    handleJobRpc(provider, call, callback, ITestJobHandlerKey, "fail-job");

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    const [err, response] = callback.mock.calls[0];
    expect(err).toBeNull();
    expect(response.data.jobName).toBe("fail-job");
    expect(response.data.rowsAffected).toBe(0);
    expect(response.data.durationMs).toBe("0");
    expect(response.data.lockAcquired).toBe(false);
  });

  it("should return INTERNAL error when handler throws", async () => {
    handlerMock.handleAsync.mockRejectedValue(new Error("DB connection lost"));
    const call = createMockCall();
    const callback = vi.fn();

    handleJobRpc(provider, call, callback, ITestJobHandlerKey, "error-job");

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        code: grpc.status.INTERNAL,
        message: "DB connection lost",
      }),
    );
  });

  it("should include ISO 8601 executedAt timestamp", async () => {
    const before = new Date().toISOString();
    const call = createMockCall();
    const callback = vi.fn();

    handleJobRpc(provider, call, callback, ITestJobHandlerKey, "ts-job");

    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    const [, response] = callback.mock.calls[0];
    const executedAt = new Date(response.data.executedAt);
    expect(executedAt.getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    expect(executedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
