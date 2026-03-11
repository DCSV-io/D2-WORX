import { createMiddleware } from "hono/factory";
import { D2Result } from "@d2/result";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { REQUEST_CONTEXT_KEY } from "../context-keys.js";

export interface ServiceKeyMiddlewareOptions {
  /**
   * When true, requests without an `X-Api-Key` header are rejected with 401.
   * When false (default), missing keys are treated as browser requests.
   */
  require?: boolean;
}

/**
 * Creates Hono middleware that validates the `X-Api-Key` header for S2S calls.
 *
 * Mirrors .NET `ServiceKeyMiddleware` behavior:
 * - No header → pass through (browser request) OR 401 if `require` is set
 * - Invalid key → 401 immediately with D2Result JSON
 * - Valid key → set `isTrustedService = true` on requestContext, continue
 *
 * Must run AFTER request enrichment middleware (needs requestContext on context).
 */
export function createServiceKeyMiddleware(
  validKeys: Set<string>,
  options?: ServiceKeyMiddlewareOptions,
) {
  const requireKey = options?.require ?? false;

  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header("X-Api-Key");

    // No key → pass through or reject based on require option
    if (!apiKey) {
      if (requireKey) {
        return c.json(
          D2Result.fail({
            messages: ["API key required."],
            errorCode: "UNAUTHORIZED",
          }),
          401 as ContentfulStatusCode,
        );
      }
      await next();
      return;
    }

    // Invalid key → 401 immediately
    if (!validKeys.has(apiKey)) {
      return c.json(
        D2Result.fail({
          messages: ["Invalid API key."],
          errorCode: "UNAUTHORIZED",
        }),
        401 as ContentfulStatusCode,
      );
    }

    // Valid key → set trust flag on requestContext
    const requestContext = c.get(REQUEST_CONTEXT_KEY);
    if (requestContext) {
      requestContext.isTrustedService = true;
    }

    await next();
  });
}
