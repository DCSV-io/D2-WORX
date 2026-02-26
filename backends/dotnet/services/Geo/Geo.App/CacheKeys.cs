// -----------------------------------------------------------------------
// <copyright file="CacheKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App;

/// <summary>
/// Cache key definitions for the Geo application layer (server-only keys).
/// Shared keys (Contact, ContactsByExtKey, etc.) live in <see cref="D2.Geo.Client.CacheKeys"/>.
/// </summary>
public static class CacheKeys
{
    /// <summary>
    /// Generates a cache key for a WhoIs entity by hash ID.
    /// </summary>
    /// <param name="id">The WhoIs hash ID.</param>
    /// <returns>Cache key in format <c>geo:whois:{id}</c>.</returns>
    public static string WhoIs(string id) => $"geo:whois:{id}";

    /// <summary>
    /// Generates a cache key for a Location entity by hash ID.
    /// </summary>
    /// <param name="id">The Location hash ID.</param>
    /// <returns>Cache key in format <c>geo:location:{id}</c>.</returns>
    public static string Location(string id) => $"geo:location:{id}";
}
