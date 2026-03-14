import { D2Result } from "@d2/result";

/** HTTP methods that modify state and require CSRF protection. */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validates CSRF protection for a request. Two independent checks:
 *
 * 1. Content-Type / custom header: Requires `application/json` or `X-Requested-With`.
 * 2. Origin validation: When present, must match an allowed origin.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param contentType - Content-Type header value (or undefined)
 * @param xRequestedWith - X-Requested-With header value (or undefined)
 * @param origin - Origin header value (or undefined)
 * @param allowedOrigins - Set of trusted origins (normalized, no trailing slashes)
 * @returns null if valid, D2Result error if invalid
 */
export function validateCsrf(
  method: string,
  contentType: string | undefined,
  xRequestedWith: string | undefined,
  origin: string | undefined,
  allowedOrigins: Set<string>,
): D2Result | null {
  // Safe methods don't need CSRF protection
  if (!UNSAFE_METHODS.has(method)) {
    return null;
  }

  // Check 1: Require JSON content type or custom header
  if (!contentType?.includes("application/json") && !xRequestedWith) {
    return D2Result.forbidden();
  }

  // Check 2: Validate Origin header when present
  if (origin && !allowedOrigins.has(origin.replace(/\/+$/, ""))) {
    return D2Result.forbidden();
  }

  return null;
}

/**
 * Normalizes a list of allowed origins: strips trailing slashes for consistent comparison.
 */
export function normalizeOrigins(origins: string[]): Set<string> {
  return new Set(origins.map((o) => o.replace(/\/+$/, "")));
}
