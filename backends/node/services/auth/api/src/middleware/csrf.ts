import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { validateCsrf, normalizeOrigins } from "@d2/csrf";

/**
 * CSRF protection middleware for custom (non-BetterAuth) routes.
 * Delegates to @d2/csrf for framework-agnostic validation.
 *
 * @param allowedOrigins - The trusted origins (e.g., SvelteKit URLs)
 */
export function createCsrfMiddleware(allowedOrigins: string[]) {
  const normalizedOrigins = normalizeOrigins(allowedOrigins);

  return createMiddleware(async (c, next) => {
    const result = validateCsrf(
      c.req.method,
      c.req.header("content-type"),
      c.req.header("x-requested-with"),
      c.req.header("origin"),
      normalizedOrigins,
    );

    if (result) {
      return c.json(result, result.statusCode as ContentfulStatusCode);
    }

    return next();
  });
}
