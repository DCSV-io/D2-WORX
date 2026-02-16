import { createHash } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result } from "@d2/result";

/**
 * Session fingerprint binding — detects stolen session tokens.
 *
 * On first request in a session, computes SHA-256(User-Agent + Accept) and stores
 * it in Redis keyed by session token. On subsequent requests, recomputes and
 * compares. A mismatch means the session token is being used from a different
 * client (likely stolen) — the session is revoked immediately.
 *
 * Design decisions:
 *   - **No BetterAuth dependency**: uses injectable callbacks for storage + revocation.
 *     If we ever swap auth libraries, this middleware works unchanged.
 *   - **IP not included**: IPs change legitimately (mobile networks, VPN toggle).
 *     UA + Accept headers identify the client software, which doesn't change
 *     mid-session under normal use.
 *   - **Redis-backed**: fingerprint must be shared across instances (no sticky sessions).
 *   - **TTL**: matches session duration so Redis doesn't leak keys.
 */

/** Callback to store a fingerprint for a session. */
export type StoreFingerprint = (sessionToken: string, fingerprint: string) => Promise<void>;
/** Callback to retrieve the stored fingerprint for a session. */
export type GetFingerprint = (sessionToken: string) => Promise<string | null>;
/** Callback to revoke a session (called on fingerprint mismatch). */
export type RevokeSession = (sessionToken: string) => Promise<void>;

export interface SessionFingerprintOptions {
  /** Store a fingerprint for a session token. */
  storeFingerprint: StoreFingerprint;
  /** Retrieve the stored fingerprint for a session token. */
  getFingerprint: GetFingerprint;
  /** Revoke the session (called when fingerprint mismatch is detected). */
  revokeSession: RevokeSession;
  /**
   * Extract the session token from the request headers.
   * Default: reads the `better-auth.session_token` cookie value.
   */
  extractSessionToken?: (headers: Headers) => string | null;
}

/** Default session token extractor: BetterAuth session_token cookie or Bearer header. */
function defaultExtractSessionToken(headers: Headers): string | null {
  // Check cookie first
  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    // Parse cookie header for better-auth.session_token
    // Cookie format: name=value; name2=value2
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

/**
 * Computes SHA-256 fingerprint from request headers.
 * Uses User-Agent + Accept — headers that identify the client software.
 *
 * Exported so the JWT `definePayload` hook can embed the same fingerprint
 * in the `fp` claim for gateway-side validation.
 */
export function computeFingerprint(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  const accept = headers.get("accept") ?? "";
  return createHash("sha256").update(`${ua}|${accept}`, "utf8").digest("hex");
}

/**
 * Creates session fingerprint binding middleware.
 *
 * Must be applied AFTER session middleware (needs authenticated session).
 * If the fingerprint doesn't match, the session is revoked and 401 returned.
 */
export function createSessionFingerprintMiddleware(options: SessionFingerprintOptions) {
  const extractToken = options.extractSessionToken ?? defaultExtractSessionToken;

  return createMiddleware(async (c, next) => {
    const sessionToken = extractToken(c.req.raw.headers);
    if (!sessionToken) {
      // No session token = not authenticated. Let session middleware handle it.
      return next();
    }

    const fingerprint = computeFingerprint(c.req.raw.headers);

    let storedFingerprint: string | null;
    try {
      storedFingerprint = await options.getFingerprint(sessionToken);
    } catch {
      // Redis down — fail open (same as rate limiter fail-open policy).
      // The session is still validated by BetterAuth's normal flow.
      return next();
    }

    if (storedFingerprint === null) {
      // First request with this session token — store the fingerprint
      try {
        await options.storeFingerprint(sessionToken, fingerprint);
      } catch {
        // Storage failure — continue without fingerprint binding
      }
      return next();
    }

    if (storedFingerprint !== fingerprint) {
      // Fingerprint mismatch — session token is likely stolen
      try {
        await options.revokeSession(sessionToken);
      } catch {
        // Best-effort revocation — even if it fails, we reject this request
      }

      return c.json(D2Result.unauthorized(), 401 as ContentfulStatusCode);
    }

    // Fingerprint matches — proceed
    return next();
  });
}
