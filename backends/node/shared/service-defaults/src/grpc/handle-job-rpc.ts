import type * as grpc from "@grpc/grpc-js";
import type { ServiceKey, ServiceProvider } from "@d2/di";
import type { TriggerJobRequest, TriggerJobResponse } from "@d2/protos";
import { d2ResultToProto } from "@d2/result-extensions";
import { handleRpc } from "./handle-rpc.js";

/**
 * Standard output shape for scheduled job handlers.
 */
export interface JobRpcOutput {
  readonly rowsAffected: number;
  readonly durationMs: number;
  readonly lockAcquired: boolean;
}

type JobHandler<T> = {
  handleAsync(input: Record<string, never>): Promise<import("@d2/result").D2Result<T | undefined>>;
};

/**
 * Handles a scheduled job RPC call with standard boilerplate:
 * trace context extraction, DI scope creation, handler resolution,
 * proto response mapping, error handling, and scope disposal.
 *
 * This is a thin wrapper around {@link handleRpc} with job-specific defaults:
 * - Empty input (`{}`)
 * - Standard `TriggerJobResponse` mapping with `JobExecutionData`
 *
 * @param provider - Root DI provider for creating per-RPC scopes.
 * @param call - The gRPC server unary call.
 * @param callback - The gRPC response callback.
 * @param handlerKey - DI key for the job handler to resolve and execute.
 * @param jobName - Human-readable job name for the response envelope.
 */
export function handleJobRpc<TOutput extends JobRpcOutput>(
  provider: ServiceProvider,
  call: grpc.ServerUnaryCall<TriggerJobRequest, TriggerJobResponse>,
  callback: grpc.sendUnaryData<TriggerJobResponse>,
  handlerKey: ServiceKey<JobHandler<TOutput>>,
  jobName: string,
): void {
  handleRpc(provider, call, callback, {
    handlerKey,
    mapInput: () => ({}) as Record<string, never>,
    mapResponse: (result) => ({
      result: d2ResultToProto(result),
      data: {
        jobName,
        rowsAffected: result.data?.rowsAffected ?? 0,
        durationMs: String(result.data?.durationMs ?? 0),
        lockAcquired: result.data?.lockAcquired ?? false,
        executedAt: new Date().toISOString(),
      },
    }),
  });
}
