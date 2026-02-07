// -----------------------------------------------------------------------
// <copyright file="RequestInfo.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

/// <summary>
/// Concrete implementation of <see cref="IRequestInfo"/>.
/// </summary>
public class RequestInfo : IRequestInfo
{
    /// <inheritdoc/>
    public required string ClientIp { get; init; }

    /// <inheritdoc/>
    public required string ServerFingerprint { get; init; }

    /// <inheritdoc/>
    public string? ClientFingerprint { get; init; }

    /// <inheritdoc/>
    public string? UserId { get; set; }

    /// <inheritdoc/>
    public bool IsAuthenticated { get; set; }

    /// <inheritdoc/>
    public string? WhoIsHashId { get; init; }

    /// <inheritdoc/>
    public string? City { get; init; }

    /// <inheritdoc/>
    public string? CountryCode { get; init; }

    /// <inheritdoc/>
    public string? SubdivisionCode { get; init; }

    /// <inheritdoc/>
    public bool? IsVpn { get; init; }

    /// <inheritdoc/>
    public bool? IsProxy { get; init; }

    /// <inheritdoc/>
    public bool? IsTor { get; init; }

    /// <inheritdoc/>
    public bool? IsHosting { get; init; }
}
