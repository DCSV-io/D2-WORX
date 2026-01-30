// -----------------------------------------------------------------------
// <copyright file="GeoAppOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App;

/// <summary>
/// Configuration options for the Geo Application layer.
/// </summary>
public class GeoAppOptions
{
    /// <summary>
    /// Gets or sets the duration after which location data expires.
    /// </summary>
    public TimeSpan LocationExpirationDuration { get; set; } = TimeSpan.FromHours(1);
}
