// -----------------------------------------------------------------------
// <copyright file="IGeoRefDataService.SetOnDisk.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.GeoRefDataService;

using D2.Contracts.Handler;
using D2.Services.Protos.Geo.V1;

/// <inheritdoc cref="IGeoRefDataService"/>
public partial interface IGeoRefDataService
{
    /// <summary>
    /// Handler for setting geographic reference data to a file on disk.
    /// </summary>
    public interface ISetOnDiskHandler : IHandler<SetOnDiskInput, SetOnDiskOutput>;

    /// <summary>
    /// Input for setting geographic reference data to a file on disk.
    /// </summary>
    ///
    /// <param name="Data">
    /// The geographic reference data.
    /// </param>
    public record SetOnDiskInput(GetReferenceDataResponse Data);

    /// <summary>
    /// Output for setting geographic reference data to a file on disk.
    /// </summary>
    public record SetOnDiskOutput;
}
