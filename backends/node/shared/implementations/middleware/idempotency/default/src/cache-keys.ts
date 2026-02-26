/**
 * Centralized cache key definitions for the idempotency middleware.
 */
export const IDEMPOTENCY_CACHE_KEYS = {
  /** Idempotency key. Format: `idempotency:{key}` */
  entry: (key: string) => `idempotency:${key}`,
} as const;
