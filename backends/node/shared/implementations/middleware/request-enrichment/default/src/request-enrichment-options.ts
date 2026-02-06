/**
 * Configuration options for request enrichment.
 * Mirrors D2.Shared.RequestEnrichment.Default.RequestEnrichmentOptions in .NET.
 */
export interface RequestEnrichmentOptions {
  /** Whether to perform WhoIs lookups for non-localhost IPs. Default: true. */
  enableWhoIsLookup: boolean;
  /** Header name for client-provided fingerprint. Default: "x-client-fingerprint". */
  clientFingerprintHeader: string;
}

/** Default request enrichment options. */
export const DEFAULT_REQUEST_ENRICHMENT_OPTIONS: RequestEnrichmentOptions = {
  enableWhoIsLookup: true,
  clientFingerprintHeader: "x-client-fingerprint",
};
