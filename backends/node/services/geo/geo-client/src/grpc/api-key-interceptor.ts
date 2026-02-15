import { InterceptingCall, type Interceptor } from "@grpc/grpc-js";

/**
 * Creates a gRPC interceptor that adds an `x-api-key` metadata header to every call.
 * Used by Geo client libraries to authenticate to the Geo service.
 */
export function createApiKeyInterceptor(apiKey: string): Interceptor {
  return (options, nextCall) =>
    new InterceptingCall(nextCall(options), {
      start(metadata, listener, next) {
        metadata.set("x-api-key", apiKey);
        next(metadata, listener);
      },
    });
}
