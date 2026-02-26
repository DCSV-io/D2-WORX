// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

/// <summary>
/// Proxy headers that the IP resolver can trust.
/// </summary>
public enum TrustedProxyHeader
{
    /// <summary>Cloudflare CF-Connecting-IP header.</summary>
    CfConnectingIp,

    /// <summary>Nginx/reverse proxy X-Real-IP header.</summary>
    XRealIp,

    /// <summary>Standard X-Forwarded-For header.</summary>
    XForwardedFor,
}

/// <summary>
/// Configuration options for request enrichment middleware.
/// </summary>
public class RequestEnrichmentOptions
{
    /// <summary>
    /// Gets or sets a value indicating whether to perform WhoIs lookups.
    /// </summary>
    /// <remarks>
    /// When enabled, the middleware will call the Geo service to resolve
    /// geographic information for the client IP address.
    /// Default is true.
    /// </remarks>
    public bool EnableWhoIsLookup { get; set; } = true;

    /// <summary>
    /// Gets or sets the header name for client-provided fingerprint.
    /// </summary>
    /// <remarks>
    /// Default is "X-Client-Fingerprint".
    /// </remarks>
    public string ClientFingerprintHeader { get; set; } = "X-Client-Fingerprint";

    /// <summary>
    /// Gets or sets the proxy headers trusted for IP resolution.
    /// </summary>
    /// <remarks>
    /// Only headers in this set are checked — others are ignored.
    /// Default: Cloudflare only (CfConnectingIp).
    /// Set to all three to trust any proxy.
    /// </remarks>
    public HashSet<TrustedProxyHeader> TrustedProxyHeaders { get; set; } =
        [TrustedProxyHeader.CfConnectingIp];
}
