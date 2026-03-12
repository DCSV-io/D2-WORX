/**
 * JWT lifecycle manager — obtains, caches, and refreshes RS256 JWTs
 * from the Auth service for server-to-server gateway calls.
 *
 * - Caches JWTs per session (keyed by session cookie hash)
 * - Auto-refreshes before 15-minute expiry (refreshes at ~12 minutes)
 * - Concurrent requests for the same session share a single pending refresh
 *
 * SECURITY: The cache MUST be keyed per session to prevent cross-user JWT leakage.
 * A single shared cache entry would serve User A's JWT to User B during SSR.
 */
import { createHash } from "node:crypto";
import type { ILogger } from "@d2/logging";
import type { AuthBffConfig } from "./types.js";

/** Minimum remaining lifetime before refreshing (3 minutes in ms). */
const REFRESH_BUFFER_MS = 3 * 60 * 1000;

const DEFAULT_TIMEOUT = 5000;

/** Max cached JWTs (one per active session). Prevents unbounded growth. */
const MAX_CACHE_SIZE = 10_000;

interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

/** Truncated SHA-256 of the session cookie — safe, fast, fixed-size cache key. */
function sessionKey(sessionCookie: string): string {
  return createHash("sha256").update(sessionCookie).digest("hex").slice(0, 16);
}

export class JwtManager {
  private readonly config: AuthBffConfig;
  private readonly logger: ILogger;
  private readonly cache = new Map<string, CachedToken>();
  private readonly pendingRefreshes = new Map<string, Promise<string | null>>();

  constructor(config: AuthBffConfig, logger: ILogger) {
    this.config = {
      ...config,
      authServiceUrl: config.authServiceUrl.replace(/\/+$/, ""),
    };
    this.logger = logger;
  }

  /**
   * Returns a valid JWT for the given session, refreshing if necessary.
   * @param sessionCookie The session cookie string to authenticate the JWT request.
   * @returns The JWT string, or null if the token could not be obtained.
   */
  async getToken(sessionCookie: string): Promise<string | null> {
    const key = sessionKey(sessionCookie);

    // Return cached token if still valid (with buffer) for THIS session
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt - REFRESH_BUFFER_MS) {
      return entry.token;
    }

    // Deduplicate concurrent refresh requests for the same session
    const pending = this.pendingRefreshes.get(key);
    if (pending) {
      return pending;
    }

    const promise = this.refreshToken(key, sessionCookie);
    this.pendingRefreshes.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pendingRefreshes.delete(key);
    }
  }

  /**
   * Clears cached tokens.
   * @param sessionCookie If provided, only that session's token is cleared.
   *                      If omitted, ALL cached tokens are cleared.
   */
  invalidate(sessionCookie?: string): void {
    if (sessionCookie) {
      const key = sessionKey(sessionCookie);
      this.cache.delete(key);
      this.pendingRefreshes.delete(key);
    } else {
      this.cache.clear();
      this.pendingRefreshes.clear();
    }
  }

  private async refreshToken(key: string, sessionCookie: string): Promise<string | null> {
    const timeout = this.config.timeout ?? DEFAULT_TIMEOUT;

    try {
      const fetchHeaders: Record<string, string> = { cookie: sessionCookie };
      if (this.config.apiKey) {
        fetchHeaders["x-api-key"] = this.config.apiKey;
      }

      const response = await fetch(`${this.config.authServiceUrl}/api/auth/token`, {
        method: "GET",
        headers: fetchHeaders,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        this.logger.warn("Failed to obtain JWT from Auth service", {
          status: response.status,
        });
        return null;
      }

      const data = (await response.json()) as { token: string };

      if (!data?.token || typeof data.token !== "string" || data.token.trim() === "") {
        this.logger.warn("Auth service returned empty JWT response");
        return null;
      }

      // Validate JWT structure (must have exactly 3 dot-separated segments)
      const segments = data.token.split(".");
      if (segments.length !== 3) {
        this.logger.warn("Auth service returned malformed JWT (expected 3 segments)", {
          segments: segments.length,
        });
        return null;
      }

      // Parse JWT expiry from payload (base64url-decoded middle segment)
      const expiresAt = parseJwtExpiry(data.token);

      // Evict expired entries if cache is at capacity
      if (this.cache.size >= MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [k, v] of this.cache) {
          if (v.expiresAt <= now) this.cache.delete(k);
        }
        // If still at capacity after purge, clear everything (safe — just forces re-fetches)
        if (this.cache.size >= MAX_CACHE_SIZE) {
          this.cache.clear();
        }
      }

      this.cache.set(key, { token: data.token, expiresAt });

      return data.token;
    } catch (error) {
      this.logger.warn("Failed to refresh JWT from Auth service", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

/**
 * Extracts the `exp` claim from a JWT without full verification.
 * We trust the Auth service's token — this is just for cache timing.
 */
function parseJwtExpiry(token: string): number {
  try {
    const parts = token.split(".");
    const payloadPart = parts[1];
    if (parts.length !== 3 || !payloadPart) return Date.now() + 15 * 60 * 1000; // fallback 15min

    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8")) as {
      exp?: number;
    };

    if (payload.exp) {
      return payload.exp * 1000; // exp is in seconds
    }
  } catch {
    // Fall through to default
  }

  return Date.now() + 15 * 60 * 1000; // fallback 15min
}
