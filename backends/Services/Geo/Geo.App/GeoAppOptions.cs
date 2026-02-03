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
    /// Gets or sets the duration after which Location data expires in cache.
    /// </summary>
    public TimeSpan LocationExpirationDuration { get; set; } = TimeSpan.FromHours(1);

    /// <summary>
    /// Gets or sets the duration after which WhoIs data expires in cache.
    /// </summary>
    public TimeSpan WhoIsExpirationDuration { get; set; } = TimeSpan.FromHours(1);

    /// <summary>
    /// Gets or sets the duration after which Contact data expires in cache.
    /// </summary>
    public TimeSpan ContactExpirationDuration { get; set; } = TimeSpan.FromHours(1);
}
