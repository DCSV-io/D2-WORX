/**
 * Server-side auth context module.
 *
 * Lazy singleton initialization for SessionResolver, JwtManager, and AuthProxy.
 *
 * - Production: throws FATAL if SVELTEKIT_AUTH__URL is missing.
 * - CI / skip mode: returns null when env vars are missing (auth hook skips gracefully).
 *
 * The `.server.ts` suffix ensures this module is never included in
 * client-side bundles (SvelteKit convention).
 */
import { createLogger, type ILogger } from "@d2/logging";
import {
  SessionResolver,
  JwtManager,
  AuthProxy,
  type AuthBffConfig,
} from "@d2/auth-bff-client";

export interface AuthContext {
  config: AuthBffConfig;
  sessionResolver: SessionResolver;
  jwtManager: JwtManager;
  authProxy: AuthProxy;
  logger: ILogger;
}

let cached: AuthContext | null | undefined;

/**
 * Whether auth can be skipped when env vars are missing.
 * Same pattern as middleware.server.ts INFRA_SKIPPABLE.
 */
const AUTH_SKIPPABLE =
  process.env.CI === "true" || process.env.D2_SKIP_INFRA_MIDDLEWARE === "true";

/**
 * Returns the shared auth context (lazy singleton).
 *
 * - Production: throws FATAL if SVELTEKIT_AUTH__URL is not set.
 * - CI / skip mode: returns null when env vars are missing (hooks skip gracefully).
 */
export function getAuthContext(): AuthContext | null {
  if (cached !== undefined) return cached;

  const authServiceUrl = process.env.SVELTEKIT_AUTH__URL;

  if (!authServiceUrl) {
    if (AUTH_SKIPPABLE) {
      console.warn(
        "[d2-sveltekit] Auth context skipped (missing SVELTEKIT_AUTH__URL). " +
          "Session resolution, JWT management, and auth proxy will be unavailable.",
      );
      cached = null;
      return null;
    }

    throw new Error(
      "[d2-sveltekit] FATAL: Missing required env var SVELTEKIT_AUTH__URL. " +
        "The Auth service URL must be configured. Check your .env.local file.",
    );
  }

  const apiKey = process.env.SVELTEKIT_AUTH__API_KEY;

  const logger = createLogger({ serviceName: "d2-sveltekit-auth" });
  const config: AuthBffConfig = { authServiceUrl, apiKey };

  const sessionResolver = new SessionResolver(config, logger);
  const jwtManager = new JwtManager(config, logger);
  const authProxy = new AuthProxy(config, logger);

  cached = { config, sessionResolver, jwtManager, authProxy, logger };
  logger.info("Auth context initialized.");
  return cached;
}
