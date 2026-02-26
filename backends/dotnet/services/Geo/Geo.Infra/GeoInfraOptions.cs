// -----------------------------------------------------------------------
// <copyright file="GeoInfraOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra;

/// <summary>
/// Configuration options for the Geo Infrastructure layer.
/// </summary>
public class GeoInfraOptions
{
    /// <summary>
    /// Gets or sets the batch size for repository queries.
    /// </summary>
    public int RepoQueryBatchSize { get; set; } = 500;

    /// <summary>
    /// Gets or sets the IPinfo.io API access token.
    /// </summary>
    /// <remarks>
    /// This should be stored securely via dotnet secrets or environment variables.
    /// When empty, IPinfo requests use unauthenticated (rate-limited) access.
    /// A warning is logged at startup if not configured.
    /// </remarks>
    public string IpInfoAccessToken { get; set; } = string.Empty;
}
