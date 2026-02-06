/**
 * Configuration options for rate limiting.
 * Mirrors D2.Shared.RateLimit.Default.RateLimitOptions in .NET.
 */
export interface RateLimitOptions {
  /** Sliding window size in milliseconds. Default: 60_000 (1 minute). */
  windowMs: number;
  /** Block duration in milliseconds after exceeding threshold. Default: 300_000 (5 minutes). */
  blockDurationMs: number;
  /** Max requests per window for client fingerprint dimension. Default: 100. */
  clientFingerprintThreshold: number;
  /** Max requests per window for IP dimension. Default: 5_000. */
  ipThreshold: number;
  /** Max requests per window for city dimension. Default: 25_000. */
  cityThreshold: number;
  /** Max requests per window for country dimension. Default: 100_000. */
  countryThreshold: number;
  /** Country codes exempt from country-level rate limiting (ISO 3166-1 alpha-2). Default: ["US", "CA", "GB"]. */
  whitelistedCountryCodes: string[];
}

/** Default rate limit options matching .NET defaults. */
export const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  windowMs: 60_000,
  blockDurationMs: 300_000,
  clientFingerprintThreshold: 100,
  ipThreshold: 5_000,
  cityThreshold: 25_000,
  countryThreshold: 100_000,
  whitelistedCountryCodes: ["US", "CA", "GB"],
};
