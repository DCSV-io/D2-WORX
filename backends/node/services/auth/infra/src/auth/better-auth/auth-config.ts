/**
 * Configuration for the auth service infrastructure layer.
 *
 * Passed into createAuth() to configure BetterAuth, database connections,
 * and JWT settings.
 */
export interface AuthServiceConfig {
  /** PostgreSQL connection URL (e.g., postgres://user:pass@host:5432/db) */
  readonly databaseUrl: string;

  /** Redis connection URL (e.g., redis://host:6379) */
  readonly redisUrl: string;

  /** RabbitMQ connection URL (optional — events are logged but not published when absent) */
  readonly rabbitMqUrl?: string;

  /** Base URL of the auth service (e.g., http://localhost:3000) */
  readonly baseUrl: string;

  /** Allowed CORS origin for SvelteKit (e.g., http://localhost:5173) */
  readonly corsOrigin: string;

  /** JWT issuer claim */
  readonly jwtIssuer: string;

  /** JWT audience claim */
  readonly jwtAudience: string;

  /** JWT expiration in seconds (default: 900 = 15 minutes) */
  readonly jwtExpirationSeconds?: number;

  /** JWKS key rotation interval in days (default: 30) */
  readonly jwksRotationDays?: number;

  /** Session expiration in seconds (default: 604800 = 7 days) */
  readonly sessionExpiresIn?: number;

  /** Session update age in seconds (default: 86400 = 1 day) */
  readonly sessionUpdateAge?: number;

  /** Cookie cache max age in seconds (default: 300 = 5 minutes) */
  readonly cookieCacheMaxAge?: number;

  /** Minimum password length (default: 12). Enforced by BetterAuth natively. */
  readonly passwordMinLength?: number;

  /** Maximum password length (default: 128). Enforced by BetterAuth natively. */
  readonly passwordMaxLength?: number;

  /** Application name for telemetry */
  readonly appName?: string;

  /** Geo service gRPC address (e.g., localhost:5138) */
  readonly geoAddress?: string;

  /** API key for Geo service gRPC authentication */
  readonly geoApiKey?: string;
}

/** Default values for optional config fields. */
export const AUTH_CONFIG_DEFAULTS = {
  jwtExpirationSeconds: 900,
  jwksRotationDays: 30,
  sessionExpiresIn: 604800,
  sessionUpdateAge: 86400,
  cookieCacheMaxAge: 300,
  passwordMinLength: 12,
  passwordMaxLength: 128,
  appName: "auth-service",
} as const;
