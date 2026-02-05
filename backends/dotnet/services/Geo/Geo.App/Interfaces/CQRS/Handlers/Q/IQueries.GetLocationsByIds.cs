// -----------------------------------------------------------------------
// <copyright file="IQueries.GetLocationsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.Q;

using D2.Geo.Domain.Entities;
using D2.Shared.Handler;

public partial interface IQueries
{
    /// <summary>
    /// Handler for getting locations by their IDs.
    /// </summary>
    /// <remarks>
    /// Currently not exposed via gRPC - locations are internal to the Geo service.
    /// Retained for potential future external queries or internal caching benefits.
    /// </remarks>
    public interface IGetLocationsByIdsHandler
        : IHandler<GetLocationsByIdsInput, GetLocationsByIdsOutput>;

    /// <summary>
    /// Input for getting locations by their IDs.
    /// </summary>
    ///
    /// <param name="HashIds">
    /// The location hash IDs to retrieve.
    /// </param>
    public record GetLocationsByIdsInput(List<string> HashIds);

    /// <summary>
    /// Output for getting locations by their IDs.
    /// </summary>
    ///
    /// <param name="Data">
    /// A dictionary mapping location hash IDs to their corresponding Location entities.
    /// </param>
    public record GetLocationsByIdsOutput(Dictionary<string, Location> Data);
}
