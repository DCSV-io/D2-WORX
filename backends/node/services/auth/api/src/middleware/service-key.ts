import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";
import { validateServiceKey } from "@d2/service-key";
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
 * Delegates to @d2/service-key for constant-time key validation.
 */
export function createServiceKeyMiddleware(
  validKeys: string[],
  options?: ServiceKeyMiddlewareOptions,
) {
  const requireKey = options?.require ?? false;

  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header("X-Api-Key");

    // No key -> pass through or reject based on require option
    if (!apiKey) {
      if (requireKey) {
        return c.json(
          D2Result.unauthorized({ messages: ["API key required."] }),
          401 as ContentfulStatusCode,
        );
      }

      // Explicitly mark as not-trusted (transitions from null -> false).
      const requestContext = c.get(REQUEST_CONTEXT_KEY);
      if (requestContext) {
        requestContext.isTrustedService = false;
      }
      await next();
      return;
    }

    // Validate key using constant-time comparison
    const result = validateServiceKey(apiKey, validKeys);
    if (result) {
      return c.json(result, result.statusCode as ContentfulStatusCode);
    }

    // Valid key -> set trust flag on requestContext
    const requestContext = c.get(REQUEST_CONTEXT_KEY);
    if (requestContext) {
      requestContext.isTrustedService = true;
    }

    await next();
  });
}
