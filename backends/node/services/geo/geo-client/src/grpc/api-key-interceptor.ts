import { InterceptingCall, type Interceptor } from "@grpc/grpc-js";

/**
 * Creates a gRPC interceptor that adds an `x-api-key` metadata header to every call.
 * Used by Geo client libraries to authenticate to the Geo service.
 *
 * **Security note:** The API key is transmitted in cleartext gRPC metadata.
 * Production deployments MUST use TLS (or mTLS) to protect the key in transit.
 * The `grpc.credentials.createInsecure()` default is appropriate for local
 * development with Aspire but MUST NOT be used in production.
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
