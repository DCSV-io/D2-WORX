// -----------------------------------------------------------------------
// <copyright file="IIpInfoClient.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.WhoIs;

/// <summary>
/// Interface for IP information lookup services.
/// </summary>
/// <remarks>
/// Abstracts the IPinfo.io API client for testability.
/// </remarks>
public interface IIpInfoClient
{
    /// <summary>
    /// Gets IP details for the specified IP address.
    /// </summary>
    ///
    /// <param name="ipAddress">
    /// The IP address to look up.
    /// </param>
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// The IP response containing location, ASN, and privacy data, or null if lookup failed.
    /// </returns>
    Task<IpInfoResponse?> GetDetailsAsync(string ipAddress, CancellationToken ct = default);
}
