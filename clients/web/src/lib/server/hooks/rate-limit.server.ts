/**
 * SvelteKit Handle wrapper for distributed rate limiting.
 * Mirrors auth/api/src/middleware/distributed-rate-limit.ts (~20 lines).
 *
 * Checks multi-dimensional sliding-window rate limits using enriched
 * request info from the request-enrichment handle. Returns 429 with
 * Retry-After header if any dimension exceeds its threshold.
 */
import type { Handle } from "@sveltejs/kit";
import { getMiddlewareContext } from "../middleware.server";

export function createRateLimitHandle(): Handle {
  return async ({ event, resolve }) => {
    const ctx = getMiddlewareContext();
    if (!ctx) return resolve(event);

    if (!event.locals.requestInfo) return resolve(event);

    const result = await ctx.rateLimitCheck.handleAsync({
      requestInfo: event.locals.requestInfo,
    });

    if (result.success && result.data?.isBlocked) {
      const retryAfterSec = result.data.retryAfterMs
        ? Math.ceil(result.data.retryAfterMs / 1000)
        : 300;

      return new Response(
        JSON.stringify({
          success: false,
          messages: ["Too many requests. Please slow down."],
          statusCode: 429,
          errorCode: "RATE_LIMITED",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }

    return resolve(event);
  };
}
