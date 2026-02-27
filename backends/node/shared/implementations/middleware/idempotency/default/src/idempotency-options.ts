/** Configuration options for idempotency middleware. */
export interface IdempotencyOptions {
  /** TTL for cached responses in milliseconds. Default: 24 hours. */
  cacheTtlMs: number;
  /** TTL for the in-flight sentinel lock in milliseconds. Default: 30 seconds. */
  inFlightTtlMs: number;
  /** Maximum response body size in bytes that will be cached. Default: 1 MB. */
  maxBodySizeBytes: number;
  /**
   * HTTP methods that idempotency applies to.
   * Requests with other methods skip the idempotency check entirely.
   * Default: POST, PUT, PATCH, DELETE.
   */
  applicableMethods: ReadonlySet<string>;
  /**
   * Whether error responses (4xx/5xx) should be cached.
   * When false, non-2xx responses remove the sentinel so clients can retry.
   * Default: false.
   */
  cacheErrorResponses: boolean;
}

export const DEFAULT_IDEMPOTENCY_OPTIONS: IdempotencyOptions = {
  cacheTtlMs: 86_400_000, // 24 hours
  inFlightTtlMs: 30_000, // 30 seconds
  maxBodySizeBytes: 1_048_576, // 1 MB
  applicableMethods: new Set(["POST", "PUT", "PATCH", "DELETE"]),
  cacheErrorResponses: false,
};
