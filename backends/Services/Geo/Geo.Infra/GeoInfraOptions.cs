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
}
