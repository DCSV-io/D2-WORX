import type * as grpc from "@grpc/grpc-js";
import { context, propagation, type Context } from "@opentelemetry/api";

/**
 * Extracts the W3C trace context (traceparent) from incoming gRPC metadata.
 * Returns an OTel Context with the extracted parent span, enabling child spans
 * created within this context to be properly linked in the distributed trace.
 *
 * This is needed because `@opentelemetry/instrumentation-grpc` auto-instrumentation
 * does not reliably patch `@grpc/grpc-js` server-side context extraction in ESM.
 */
export function extractGrpcTraceContext(call: grpc.ServerUnaryCall<unknown, unknown>): Context {
  const carrier: Record<string, string> = {};
  const metadata = call.metadata?.getMap();
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string") {
        carrier[key] = value;
      }
    }
  }
  return propagation.extract(context.active(), carrier);
}
