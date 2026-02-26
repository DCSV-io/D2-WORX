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
  /** Max length for client fingerprint header values. Values exceeding this are truncated. Default: 256. */
  maxFingerprintLength: number;
  /** Max length for forwarded-for / IP headers. Values exceeding this are truncated. Default: 2048. */
  maxForwardedForLength: number;
}

/** Default request enrichment options. */
export const DEFAULT_REQUEST_ENRICHMENT_OPTIONS: RequestEnrichmentOptions = {
  enableWhoIsLookup: true,
  clientFingerprintHeader: "x-client-fingerprint",
  trustedProxyHeaders: ["cf-connecting-ip"],
  maxFingerprintLength: 256,
  maxForwardedForLength: 2048,
};
