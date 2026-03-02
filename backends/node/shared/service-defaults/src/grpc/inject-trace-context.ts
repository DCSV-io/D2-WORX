import { InterceptingCall, type Interceptor } from "@grpc/grpc-js";
import { context, propagation } from "@opentelemetry/api";

/**
 * Creates a gRPC client interceptor that injects the W3C trace context
 * (`traceparent` / `tracestate`) into outgoing gRPC metadata.
 *
 * This is the client-side counterpart to {@link extractGrpcTraceContext},
 * which extracts trace context on the server side. Together they ensure
 * distributed traces propagate across gRPC service boundaries.
 *
 * Needed because `@opentelemetry/instrumentation-grpc` auto-instrumentation
 * does not reliably patch `@grpc/grpc-js` client-side context injection in ESM.
 */
export function createTraceContextInterceptor(): Interceptor {
  return (options, nextCall) =>
    new InterceptingCall(nextCall(options), {
      start(metadata, listener, next) {
        const carrier: Record<string, string> = {};
        propagation.inject(context.active(), carrier);
        for (const [key, value] of Object.entries(carrier)) {
          metadata.set(key, value);
        }
        next(metadata, listener);
      },
    });
}
