import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";
import type { RateLimit } from "@d2/interfaces";
import { REQUEST_INFO_KEY } from "./request-enrichment.js";

/**
 * Creates Hono middleware that checks distributed rate limits.
 * Must run AFTER request enrichment middleware (needs requestInfo in context).
 */
export function createDistributedRateLimitMiddleware(
  checkHandler: RateLimit.ICheckHandler,
) {
  return createMiddleware(async (c, next) => {
    const requestInfo = c.get(REQUEST_INFO_KEY);

    if (!requestInfo) {
      await next();
      return;
    }

    const result = await checkHandler.handleAsync({ requestInfo });

    if (result.success && result.data?.isBlocked) {
      const retryAfterSec = result.data.retryAfterMs
        ? Math.ceil(result.data.retryAfterMs / 1000)
        : 300;
      c.header("Retry-After", String(retryAfterSec));
      return c.json(
        D2Result.fail({
          messages: ["Too many requests. Please slow down."],
          statusCode: HttpStatusCode.TooManyRequests,
          errorCode: "RATE_LIMITED",
        }),
        429 as ContentfulStatusCode,
      );
    }

    await next();
  });
}
