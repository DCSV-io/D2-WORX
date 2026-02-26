import { isTransientError } from "@d2/utilities";

/** gRPC status codes that are considered transient. */
const TRANSIENT_GRPC_CODES = new Set([
  4, // DEADLINE_EXCEEDED
  8, // RESOURCE_EXHAUSTED
  10, // ABORTED
  13, // INTERNAL
  14, // UNAVAILABLE
]);

/**
 * Transient error detector that understands gRPC status codes.
 *
 * Checks for gRPC ServiceError (duck-typed: numeric `code` property in transient set),
 * then delegates to the generic `isTransientError` for connection/timeout patterns.
 *
 * Use this as the `isTransientError` option for `retryAsync` when retrying gRPC calls.
 */
export function isTransientGrpcError(error: unknown): boolean {
  // gRPC ServiceError (duck-type: has numeric `code` property)
  if (error != null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "number" && TRANSIENT_GRPC_CODES.has(code)) return true;
  }

  // Delegate to generic transient detection (connection/timeout patterns)
  return isTransientError(error);
}
