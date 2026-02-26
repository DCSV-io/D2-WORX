/** Proxy headers that the IP resolver can trust. */
export type TrustedProxyHeader = "cf-connecting-ip" | "x-real-ip" | "x-forwarded-for";

/**
 * Configuration options for request enrichment.
 * Mirrors D2.Shared.RequestEnrichment.Default.RequestEnrichmentOptions in .NET.
 */
export interface RequestEnrichmentOptions {
  /** Whether to perform WhoIs lookups for non-localhost IPs. Default: true. */
  enableWhoIsLookup: boolean;
  /** Header name for client-provided fingerprint. Default: "x-client-fingerprint". */
  clientFingerprintHeader: string;
  /**
   * Which proxy headers to trust for IP resolution.
   * Only headers in this list will be checked — others are ignored.
   * Default: ["cf-connecting-ip"] (Cloudflare only).
   *
   * Set to all three to trust any proxy:
   * ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"]
   */
  trustedProxyHeaders: readonly TrustedProxyHeader[];
}

/** Default request enrichment options. */
export const DEFAULT_REQUEST_ENRICHMENT_OPTIONS: RequestEnrichmentOptions = {
  enableWhoIsLookup: true,
  clientFingerprintHeader: "x-client-fingerprint",
  trustedProxyHeaders: ["cf-connecting-ip"],
};
