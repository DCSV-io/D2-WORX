/**
 * Represents enriched request context information populated by middleware.
 * Mirrors D2.Shared.RequestEnrichment.Default.IRequestInfo in .NET.
 */
export interface IRequestInfo {
  /** Resolved client IP address. Always present. */
  readonly clientIp: string;
  /** Server-computed fingerprint (64-char lowercase hex SHA-256). */
  readonly serverFingerprint: string;
  /** Client-provided fingerprint from X-Client-Fingerprint header. */
  readonly clientFingerprint: string | undefined;
  /** WhoIs content-addressable hash ID. */
  readonly whoIsHashId: string | undefined;
  /** City name from WhoIs data. */
  readonly city: string | undefined;
  /** ISO 3166-1 alpha-2 country code from WhoIs data. */
  readonly countryCode: string | undefined;
  /** ISO 3166-2 subdivision code from WhoIs data. */
  readonly subdivisionCode: string | undefined;
  /** Whether the IP is from a VPN. */
  readonly isVpn: boolean | undefined;
  /** Whether the IP is from a proxy. */
  readonly isProxy: boolean | undefined;
  /** Whether the IP is from a Tor exit node. */
  readonly isTor: boolean | undefined;
  /** Whether the IP is from a hosting provider. */
  readonly isHosting: boolean | undefined;
  /** Authenticated user ID (set by auth middleware later). */
  userId: string | undefined;
  /** Whether the request is authenticated (set by auth middleware later). */
  isAuthenticated: boolean;
  /** Whether the request is from a trusted service (set by service-key middleware later). */
  isTrustedService: boolean;
}
