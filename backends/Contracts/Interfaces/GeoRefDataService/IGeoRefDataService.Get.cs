// -----------------------------------------------------------------------
// <copyright file="IGeoRefDataService.Get.cs" company="DCSV">
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
    /// Handler for getting geographic reference data.
    /// </summary>
    public interface IGetHandler : IHandler<GetInput, GetOutput>;

    /// <summary>
    /// Input for getting geographic reference data.
    /// </summary>
    public record GetInput;

    /// <summary>
    /// Output for getting geographic reference data.
    /// </summary>
    ///
    /// <param name="Data">
    /// The geographic reference data retrieved.
    /// </param>
    public record GetOutput(GetReferenceDataResponse Data);
}
