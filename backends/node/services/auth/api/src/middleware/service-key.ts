import { createMiddleware } from "hono/factory";
import { D2Result } from "@d2/result";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { REQUEST_CONTEXT_KEY } from "../context-keys.js";

/**
 * Creates Hono middleware that validates the `X-Api-Key` header for S2S calls.
 *
 * Mirrors .NET `ServiceKeyMiddleware` behavior:
 * - No header → pass through (browser request)
 * - Invalid key → 401 immediately with D2Result JSON
 * - Valid key → set `isTrustedService = true` on requestContext, continue
 *
 * Must run AFTER request enrichment middleware (needs requestContext on context).
 */
export function createServiceKeyMiddleware(validKeys: Set<string>) {
  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header("X-Api-Key");

    // No key → treat as browser request, continue normally
    if (!apiKey) {
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
