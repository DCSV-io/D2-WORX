/**
 * Centralized cache key definitions for the rate limiting middleware.
 */
export const RATELIMIT_CACHE_KEYS = {
  /** Rate limit counter. Format: `ratelimit:{dimension}:{value}:{windowId}` */
  counter: (dimension: string, value: string, windowId: string) =>
    `ratelimit:${dimension}:${value}:${windowId}`,

  /** Blocked dimension marker. Format: `blocked:{dimension}:{value}` */
  blocked: (dimension: string, value: string) => `blocked:${dimension}:${value}`,
} as const;
