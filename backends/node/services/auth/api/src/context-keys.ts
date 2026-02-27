/**
 * Hono context variable keys — centralized for maintainability.
 *
 * Use these constants instead of string literals when calling `c.get()` / `c.set()`.
 * Matches the pattern used by SESSION_FIELDS in @d2/auth-domain.
 */
export const USER_KEY = "user" as const;
export const SESSION_KEY = "session" as const;
export const SCOPE_KEY = "scope" as const;
export const REQUEST_INFO_KEY = "requestInfo" as const;
