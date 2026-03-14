import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { computeFingerprint as computeFp, checkSessionFingerprint } from "@d2/session-fingerprint";
import type { CheckSessionFingerprintOptions } from "@d2/session-fingerprint";

// Re-export types for composition-root.ts
export type { StoreFingerprint, GetFingerprint, RevokeSession } from "@d2/session-fingerprint";

/**
 * Computes SHA-256 fingerprint from request headers.
 * Exported so the JWT `definePayload` hook can embed the same fingerprint
 * in the `fp` claim for gateway-side validation.
 */
export function computeFingerprint(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  const accept = headers.get("accept") ?? "";
  return computeFp(ua, accept);
}

/** Default session token extractor: BetterAuth session_token cookie or Bearer header. */
function defaultExtractSessionToken(headers: Headers): string | null {
  // Check cookie first
  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith("better-auth.session_token=")) {
        const value = trimmed.slice("better-auth.session_token=".length);
        if (value) return value;
      }
    }
  }

  // Fall back to Authorization: Bearer header (bearer plugin)
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) || null;
  }

  return null;
}

export interface SessionFingerprintMiddlewareOptions extends CheckSessionFingerprintOptions {
  /**
   * Extract the session token from the request headers.
   * Default: reads the `better-auth.session_token` cookie value.
   */
  extractSessionToken?: (headers: Headers) => string | null;
}

/**
 * Creates session fingerprint binding middleware.
 * Delegates to @d2/session-fingerprint for framework-agnostic validation.
 */
export function createSessionFingerprintMiddleware(options: SessionFingerprintMiddlewareOptions) {
  const extractToken = options.extractSessionToken ?? defaultExtractSessionToken;

  return createMiddleware(async (c, next) => {
    const sessionToken = extractToken(c.req.raw.headers);
    if (!sessionToken) {
      return next();
    }

    const fingerprint = computeFingerprint(c.req.raw.headers);
    const result = await checkSessionFingerprint(sessionToken, fingerprint, options);

    if (result) {
      return c.json(result, result.statusCode as ContentfulStatusCode);
    }

    return next();
  });
}
