/** Configuration options for idempotency middleware. */
export interface IdempotencyOptions {
  /** TTL for cached responses in milliseconds. Default: 24 hours. */
  cacheTtlMs: number;
  /** TTL for the in-flight sentinel lock in milliseconds. Default: 30 seconds. */
  inFlightTtlMs: number;
  /** Maximum response body size in bytes that will be cached. Default: 1 MB. */
  maxBodySizeBytes: number;
}

export const DEFAULT_IDEMPOTENCY_OPTIONS: IdempotencyOptions = {
  cacheTtlMs: 86_400_000, // 24 hours
  inFlightTtlMs: 30_000, // 30 seconds
  maxBodySizeBytes: 1_048_576, // 1 MB
};
