/**
 * JWT lifecycle manager — obtains, caches, and refreshes RS256 JWTs
 * from the Auth service for server-to-server gateway calls.
 *
 * - Caches JWT in memory (module-level, NOT localStorage)
 * - Auto-refreshes before 15-minute expiry (refreshes at ~12 minutes)
 * - Thread-safe: concurrent requests share the same pending refresh promise
 *
 * Not wired into SvelteKit hooks yet — prepared for Step 6 gateway integration.
 */
import type { ILogger } from "@d2/logging";
import type { AuthBffConfig } from "./types.js";

/** Minimum remaining lifetime before refreshing (3 minutes in ms). */
const REFRESH_BUFFER_MS = 3 * 60 * 1000;

const DEFAULT_TIMEOUT = 5000;

interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

export class JwtManager {
  private readonly config: AuthBffConfig;
  private readonly logger: ILogger;
  private cached: CachedToken | null = null;
  private pendingRefresh: Promise<string | null> | null = null;

  constructor(config: AuthBffConfig, logger: ILogger) {
    this.config = {
      ...config,
      authServiceUrl: config.authServiceUrl.replace(/\/+$/, ""),
    };
    this.logger = logger;
  }

  /**
   * Returns a valid JWT, refreshing if necessary.
   * @param sessionCookie The session cookie string to authenticate the JWT request.
   * @returns The JWT string, or null if the token could not be obtained.
   */
  async getToken(sessionCookie: string): Promise<string | null> {
    // Return cached token if still valid (with buffer)
    if (this.cached && Date.now() < this.cached.expiresAt - REFRESH_BUFFER_MS) {
      return this.cached.token;
    }

    // Deduplicate concurrent refresh requests
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    this.pendingRefresh = this.refreshToken(sessionCookie);
    try {
      return await this.pendingRefresh;
    } finally {
      this.pendingRefresh = null;
    }
  }

  /** Clears the cached token (e.g., on sign-out or session change). */
  invalidate(): void {
    this.cached = null;
    this.pendingRefresh = null;
  }

  private async refreshToken(sessionCookie: string): Promise<string | null> {
    const timeout = this.config.timeout ?? DEFAULT_TIMEOUT;

    try {
      const fetchHeaders: Record<string, string> = { cookie: sessionCookie };
      if (this.config.apiKey) {
        fetchHeaders["x-api-key"] = this.config.apiKey;
      }

      const response = await fetch(
        `${this.config.authServiceUrl}/api/auth/token`,
        {
          method: "GET",
          headers: fetchHeaders,
          signal: AbortSignal.timeout(timeout),
        },
      );

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

      this.cached = {
        token: data.token,
        expiresAt,
      };

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

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf-8"),
    ) as { exp?: number };

    if (payload.exp) {
      return payload.exp * 1000; // exp is in seconds
    }
  } catch {
    // Fall through to default
  }

  return Date.now() + 15 * 60 * 1000; // fallback 15min
}
