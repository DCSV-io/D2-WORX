import type * as grpc from "@grpc/grpc-js";
import { context } from "@opentelemetry/api";
import { extractGrpcTraceContext } from "./extract-trace-context.js";

/**
 * Runs an async RPC handler within the extracted gRPC trace context.
 * This ensures all child spans (BaseHandler, pg, dns, etc.) are properly
 * parented under the caller's trace.
 */
export function withTraceContext<TReq, TRes>(
  call: grpc.ServerUnaryCall<TReq, TRes>,
  fn: () => Promise<void>,
): Promise<void> {
  const parentCtx = extractGrpcTraceContext(call as grpc.ServerUnaryCall<unknown, unknown>);
  return context.with(parentCtx, fn);
}
