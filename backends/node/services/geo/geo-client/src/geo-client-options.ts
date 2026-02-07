/** Configuration options for the Geo Client library. */
export interface GeoClientOptions {
  /** Duration in ms after which WhoIs cache entries expire. Default: 28,800,000 (8 hours). */
  whoIsCacheExpirationMs: number;
  /** Maximum number of WhoIs entries in the local cache (LRU eviction). Default: 10,000. */
  whoIsCacheMaxEntries: number;
  /** Directory for persisted data files. Default: "./data". */
  dataDir: string;
}

export const DEFAULT_GEO_CLIENT_OPTIONS: GeoClientOptions = {
  whoIsCacheExpirationMs: 28_800_000,
  whoIsCacheMaxEntries: 10_000,
  dataDir: "./data",
};
