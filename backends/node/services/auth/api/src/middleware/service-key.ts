import { createMiddleware } from "hono/factory";
import { D2Result } from "@d2/result";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { REQUEST_INFO_KEY } from "../context-keys.js";

/**
 * Creates Hono middleware that validates the `X-Api-Key` header for S2S calls.
 *
 * Mirrors .NET `ServiceKeyMiddleware` behavior:
 * - No header → pass through (browser request)
 * - Invalid key → 401 immediately with D2Result JSON
 * - Valid key → set `isTrustedService = true` on requestInfo, continue
 *
 * Must run AFTER request enrichment middleware (needs requestInfo on context).
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

    // Valid key → set trust flag on requestInfo
    const requestInfo = c.get(REQUEST_INFO_KEY);
    if (requestInfo) {
      requestInfo.isTrustedService = true;
    }

    await next();
  });
}
