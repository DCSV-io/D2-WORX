// -----------------------------------------------------------------------
// <copyright file="GeoClientOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client;

/// <summary>
/// Configuration options for the Geo Client library.
/// </summary>
public class GeoClientOptions
{
    /// <summary>
    /// Gets or sets the duration after which WhoIs cache entries expire.
    /// </summary>
    public TimeSpan WhoIsCacheExpiration { get; set; } = TimeSpan.FromHours(8);

    /// <summary>
    /// Gets or sets the maximum number of WhoIs entries in the local cache (LRU eviction).
    /// </summary>
    public int WhoIsCacheMaxEntries { get; set; } = 10_000;

    /// <summary>
    /// Gets or sets the context keys allowed for contact operations.
    /// Client-side defense-in-depth validation. Empty list disables validation.
    /// </summary>
    public List<string> AllowedContextKeys { get; set; } = [];

    /// <summary>
    /// Gets or sets the API key sent via gRPC metadata (x-api-key header) for Geo service authentication.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;
}
