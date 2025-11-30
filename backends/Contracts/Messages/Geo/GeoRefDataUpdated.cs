// -----------------------------------------------------------------------
// <copyright file="GeoRefDataUpdated.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Messages.Geo;

/// <summary>
/// Message indicating that geographic reference data has been updated.
/// </summary>
///
/// <param name="Version">
/// The version of the updated geographic reference data.
/// </param>
public record GeoRefDataUpdated(string Version)
{
    /// <summary>
    /// Initializes a new instance of the <see cref="GeoRefDataUpdated"/> class with a
    /// parameterless constructor for compatibility.
    /// </summary>
    public GeoRefDataUpdated()
        : this(string.Empty)
    {
    }
}
