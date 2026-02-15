import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory per-IP rate limiter.
 *
 * This is a stopgap for single-IP abuse prevention. The full @d2/ratelimit
 * package (multi-dimensional sliding window across IP/city/country, Redis-backed)
 * replaces this when the request enrichment pipeline is wired in.
 *
 * In production, Cloudflare handles DDoS at the edge before requests reach us.
 * The periodic cleanup prevents unbounded memory growth under normal traffic.
 *
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 */
export function createRateLimitMiddleware(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every windowMs to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs) {
        store.delete(key);
      }
    }
  }, windowMs);

  // Allow Node to exit even if interval is active
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return createMiddleware(async (c, next) => {
    const ip = resolveClientIp(c.req.raw.headers) ?? "unknown";
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
      store.set(ip, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      return c.json(
        D2Result.fail({
          messages: ["Too many requests. Please slow down."],
          statusCode: HttpStatusCode.TooManyRequests,
        }),
        429 as ContentfulStatusCode,
      );
    }

    await next();
  });
}

function resolveClientIp(headers: Headers): string | null {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
