/**
 * Server-side auth context module.
 *
 * Lazy singleton initialization for SessionResolver, JwtManager, and AuthProxy.
 * Hard-fails if SVELTEKIT_AUTH__URL is missing — auth is REQUIRED for all
 * environments (the back-end must always be running).
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

let cached: AuthContext | undefined;

/**
 * Returns the shared auth context (lazy singleton).
 * Throws if SVELTEKIT_AUTH__URL is not set — auth is required in all environments.
 */
export function getAuthContext(): AuthContext {
  if (cached) return cached;

  const authServiceUrl = process.env.SVELTEKIT_AUTH__URL;

  if (!authServiceUrl) {
    throw new Error(
      "[d2-sveltekit] FATAL: Missing required env var SVELTEKIT_AUTH__URL. " +
        "The Auth service URL must be configured. Check your .env.local file.",
    );
  }

  const logger = createLogger({ serviceName: "d2-sveltekit-auth" });
  const config: AuthBffConfig = { authServiceUrl };

  const sessionResolver = new SessionResolver(config, logger);
  const jwtManager = new JwtManager(config, logger);
  const authProxy = new AuthProxy(config, logger);

  cached = { config, sessionResolver, jwtManager, authProxy, logger };
  logger.info("Auth context initialized.");
  return cached;
}
