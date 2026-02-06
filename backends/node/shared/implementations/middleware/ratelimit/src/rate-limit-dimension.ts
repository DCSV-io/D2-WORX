/**
 * Represents a dimension used for rate limiting.
 * Mirrors D2.Shared.RateLimit.Default.RateLimitDimension in .NET.
 */
export const RateLimitDimension = {
  ClientFingerprint: "ClientFingerprint",
  Ip: "Ip",
  City: "City",
  Country: "Country",
} as const;

export type RateLimitDimension = (typeof RateLimitDimension)[keyof typeof RateLimitDimension];
