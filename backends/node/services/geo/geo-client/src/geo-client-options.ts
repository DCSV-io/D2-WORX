/** Configuration options for the Geo Client library. */
export interface GeoClientOptions {
  /** Duration in ms after which WhoIs cache entries expire. Default: 28,800,000 (8 hours). */
  whoIsCacheExpirationMs: number;
  /** Maximum number of WhoIs entries in the local cache (LRU eviction). Default: 10,000. */
  whoIsCacheMaxEntries: number;
  /** Directory for persisted data files. Default: "./data". */
  dataDir: string;
  /** Maximum number of Contact entries in the local cache (LRU eviction). Default: 10,000. No TTL — contacts are immutable. */
  contactCacheMaxEntries: number;
  /** Client-side validation: only these context keys are allowed for contact operations. Empty array disables validation. */
  allowedContextKeys: string[];
  /** API key sent via gRPC metadata (`x-api-key` header) for Geo service authentication. */
  apiKey: string;
  /** Timeout in ms for gRPC calls to the Geo service. Default: 30,000 (30 seconds). */
  grpcTimeoutMs: number;
  /** Duration in ms for negative cache entries (WhoIs not found). Default: 3,600,000 (1 hour). */
  whoIsNegativeCacheExpirationMs: number;
  /** Consecutive gRPC failures before the circuit breaker opens. Default: 5. */
  circuitBreakerFailureThreshold: number;
  /** Duration in ms the circuit stays open before probing. Default: 30,000 (30s). */
  circuitBreakerCooldownMs: number;
}

export const DEFAULT_GEO_CLIENT_OPTIONS: GeoClientOptions = {
  whoIsCacheExpirationMs: 28_800_000,
  whoIsCacheMaxEntries: 10_000,
  dataDir: "./data",
  contactCacheMaxEntries: 10_000,
  allowedContextKeys: [],
  apiKey: "",
  grpcTimeoutMs: 30_000,
  whoIsNegativeCacheExpirationMs: 3_600_000,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerCooldownMs: 30_000,
};
