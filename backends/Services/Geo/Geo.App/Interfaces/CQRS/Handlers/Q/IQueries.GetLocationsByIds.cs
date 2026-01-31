// -----------------------------------------------------------------------
// <copyright file="IQueries.GetLocationsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.Q;

using D2.Contracts.Handler;
using D2.Services.Protos.Geo.V1;

public partial interface IQueries
{
    /// <summary>
    /// Handler for getting locations by their IDs.
    /// </summary>
    public interface IGetLocationsByIdsHandler
        : IHandler<GetLocationsByIdsInput, GetLocationsByIdsOutput>;

    /// <summary>
    /// Input for getting locations by their IDs.
    /// </summary>
    ///
    /// <param name="Request">
    /// The request containing the location IDs to retrieve.
    /// </param>
    public record GetLocationsByIdsInput(GetLocationsRequest Request);

    /// <summary>
    /// Output for getting locations by their IDs.
    /// </summary>
    ///
    /// <param name="Data">
    /// A dictionary mapping location IDs to their corresponding LocationDTOs.
    /// </param>
    public record GetLocationsByIdsOutput(Dictionary<string, LocationDTO> Data);
}
