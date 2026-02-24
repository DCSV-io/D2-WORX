import * as grpc from "@grpc/grpc-js";
import type { ILogger } from "@d2/logging";

/**
 * Wraps a CommsServiceServer implementation with API key validation.
 * Checks the `x-api-key` metadata header against the set of valid keys
 * and rejects with UNAUTHENTICATED if missing or invalid.
 *
 * Mirrors the .NET `ServiceKeyMiddleware` pattern — flat list of valid keys,
 * one per calling service (no context-key mapping needed for Comms).
 *
 * @grpc/grpc-js does not have a first-class ServerInterceptor type,
 * so we wrap each handler at the service object level.
 *
 * Note: This wrapper assumes all RPCs are unary (ServerUnaryCall + sendUnaryData).
 * Comms only defines unary RPCs. If streaming RPCs are added, this must be extended.
 */
export function withApiKeyAuth<T extends Record<string, grpc.UntypedHandleCall>>(
  service: T,
  validKeys: ReadonlySet<string>,
  logger: ILogger,
  /** Method names to pass through without API key validation (e.g. "checkHealth"). */
  exempt?: ReadonlySet<string>,
): T {
  const wrapped = {} as Record<string, grpc.UntypedHandleCall>;

  for (const [method, handler] of Object.entries(service)) {
    // Exempt methods pass through without API key checks.
    if (exempt?.has(method)) {
      wrapped[method] = handler;
      continue;
    }

    wrapped[method] = (call: grpc.ServerUnaryCall<unknown, unknown>, callback: grpc.sendUnaryData<unknown>) => {
      const apiKey = (call as grpc.ServerUnaryCall<unknown, unknown>).metadata?.get("x-api-key")?.[0];

      if (!apiKey) {
        logger.warn(`Missing x-api-key header on RPC ${method}`);
        callback({
          code: grpc.status.UNAUTHENTICATED,
          message: "Missing x-api-key header.",
        });
        return;
      }

      if (!validKeys.has(apiKey as string)) {
        logger.warn(`Invalid API key on RPC ${method}`);
        callback({
          code: grpc.status.UNAUTHENTICATED,
          message: "Invalid API key.",
        });
        return;
      }

      // Key is valid — delegate to original handler.
      (handler as grpc.handleUnaryCall<unknown, unknown>)(call, callback);
    };
  }

  return wrapped as T;
}
