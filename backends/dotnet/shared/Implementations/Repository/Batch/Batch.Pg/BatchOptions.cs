// -----------------------------------------------------------------------
// <copyright file="BatchOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Batch.Pg;

/// <summary>
/// Configuration options for batched database queries.
/// </summary>
public class BatchOptions
{
    /// <summary>
    /// Gets or sets the maximum number of IDs per batch.
    /// </summary>
    ///
    /// <remarks>
    /// Default is 500. Safe range is 100-2000.
    /// </remarks>
    public int BatchSize { get; set; } = 500;

    /// <summary>
    /// Gets or sets a value indicating whether to use AsNoTracking for read queries.
    /// </summary>
    ///
    /// <remarks>
    /// Default is true. Set to false if you need change tracking.
    /// </remarks>
    public bool AsNoTracking { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether to deduplicate input IDs before querying.
    /// </summary>
    ///
    /// <remarks>
    /// Default is true. Prevents duplicate DB lookups.
    /// </remarks>
    public bool DeduplicateIds { get; set; } = true;

    /// <summary>
    /// Gets or sets a value indicating whether to filter out null/default IDs from input.
    /// </summary>
    ///
    /// <remarks>
    /// Default is true.
    /// </remarks>
    public bool FilterNullIds { get; set; } = true;
}
