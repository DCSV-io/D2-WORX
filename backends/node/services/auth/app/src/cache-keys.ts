/**
 * Centralized cache key definitions for the Auth application layer.
 */
export const AUTH_CACHE_KEYS = {
  /** Paginated sign-in events. Format: `auth:sign-in-events:{userId}:{limit}:{offset}` */
  signInEvents: (userId: string, limit: number, offset: number) =>
    `auth:sign-in-events:${userId}:${limit}:${offset}`,

  /** Sign-in throttle state. Format: `auth:sign-in-throttle:{identifierHash}:{identityHash}` */
  signInThrottle: (identifierHash: string, identityHash: string) =>
    `auth:sign-in-throttle:${identifierHash}:${identityHash}`,
} as const;
