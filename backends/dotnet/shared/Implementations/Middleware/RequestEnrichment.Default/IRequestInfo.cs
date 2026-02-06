// -----------------------------------------------------------------------
// <copyright file="IRequestInfo.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

/// <summary>
/// Represents enriched request context information populated by middleware.
/// </summary>
public interface IRequestInfo
{
    /// <summary>
    /// Gets the resolved client IP address.
    /// </summary>
    /// <remarks>
    /// Always present. Resolved from CF-Connecting-IP, X-Real-IP, X-Forwarded-For,
    /// or RemoteIpAddress in that priority order.
    /// </remarks>
    string ClientIp { get; }

    /// <summary>
    /// Gets the server-computed fingerprint based on request headers.
    /// </summary>
    /// <remarks>
    /// SHA-256 hash of User-Agent + Accept-Language + Accept-Encoding + Accept.
    /// Used for logging and analytics, not for rate limiting.
    /// </remarks>
    string ServerFingerprint { get; }

    /// <summary>
    /// Gets the client-provided fingerprint from the X-Client-Fingerprint header.
    /// </summary>
    /// <remarks>
    /// Null if the client did not send the header. Used for rate limiting.
    /// </remarks>
    string? ClientFingerprint { get; }

    /// <summary>
    /// Gets or sets the authenticated user ID.
    /// </summary>
    /// <remarks>
    /// Set by authentication middleware after token validation.
    /// </remarks>
    string? UserId { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the request is authenticated.
    /// </summary>
    /// <remarks>
    /// Set by authentication middleware after token validation.
    /// </remarks>
    bool IsAuthenticated { get; set; }

    /// <summary>
    /// Gets the WhoIs hash ID for downstream lookups.
    /// </summary>
    /// <remarks>
    /// Content-addressable hash from the Geo service. Null if WhoIs lookup failed.
    /// </remarks>
    string? WhoIsHashId { get; }

    /// <summary>
    /// Gets the city name from WhoIs data.
    /// </summary>
    string? City { get; }

    /// <summary>
    /// Gets the ISO 3166-1 alpha-2 country code from WhoIs data.
    /// </summary>
    string? CountryCode { get; }

    /// <summary>
    /// Gets the ISO 3166-2 subdivision code from WhoIs data.
    /// </summary>
    string? SubdivisionCode { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a VPN.
    /// </summary>
    bool? IsVpn { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a proxy.
    /// </summary>
    bool? IsProxy { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a Tor exit node.
    /// </summary>
    bool? IsTor { get; }

    /// <summary>
    /// Gets a value indicating whether the IP is from a hosting provider.
    /// </summary>
    bool? IsHosting { get; }
}
