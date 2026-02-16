import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";

/** HTTP methods that modify state and require CSRF protection. */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection middleware for custom (non-BetterAuth) routes.
 *
 * Two independent checks, both must pass for state-changing requests:
 *
 * 1. **Content-Type / custom header**: Requires `Content-Type: application/json`
 *    or `X-Requested-With` header. These trigger a CORS preflight, which our
 *    restrictive CORS policy blocks for non-allowed origins.
 *
 * 2. **Origin validation**: When an `Origin` header is present (sent by browsers
 *    on all cross-origin requests and same-origin POST), it must match the
 *    configured allowed origin. This provides defense-in-depth independent of
 *    CORS configuration — even if CORS were misconfigured, the origin check
 *    would still block cross-origin state changes.
 *
 * BetterAuth handles its own CSRF protection — this is for custom routes only.
 *
 * @param allowedOrigin - The trusted origin (e.g., SvelteKit URL)
 */
export function createCsrfMiddleware(allowedOrigin: string) {
  // Normalize: strip trailing slash for consistent comparison
  const normalizedOrigin = allowedOrigin.replace(/\/+$/, "");

  return createMiddleware(async (c, next) => {
    if (!UNSAFE_METHODS.has(c.req.method)) {
      return next();
    }

    // Check 1: Require JSON content type or custom header
    const contentType = c.req.header("content-type") ?? "";
    const xRequestedWith = c.req.header("x-requested-with");

    if (!contentType.includes("application/json") && !xRequestedWith) {
      return c.json(
        D2Result.fail({
          messages: ["Invalid request. Content-Type: application/json is required."],
          statusCode: HttpStatusCode.Forbidden,
        }),
        403 as ContentfulStatusCode,
      );
    }

    // Check 2: Validate Origin header when present
    const origin = c.req.header("origin");
    if (origin && origin.replace(/\/+$/, "") !== normalizedOrigin) {
      return c.json(
        D2Result.fail({
          messages: ["Invalid request origin."],
          statusCode: HttpStatusCode.Forbidden,
        }),
        403 as ContentfulStatusCode,
      );
    }

    return next();
  });
}
