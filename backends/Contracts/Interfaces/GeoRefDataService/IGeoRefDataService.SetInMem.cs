// -----------------------------------------------------------------------
// <copyright file="IGeoRefDataService.SetInMem.cs" company="DCSV">
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
    /// Handler for setting geographic reference data to an in-memory cache.
    /// </summary>
    public interface ISetInMemHandler : IHandler<SetInMemInput, SetInMemOutput>;

    /// <summary>
    /// Input for setting geographic reference data to an in-memory cache.
    /// </summary>
    ///
    /// <param name="Data">
    /// The geographic reference data.
    /// </param>
    public record SetInMemInput(GetReferenceDataResponse Data);

    /// <summary>
    /// Output for setting geographic reference data to an in-memory cache.
    /// </summary>
    public record SetInMemOutput;
}
