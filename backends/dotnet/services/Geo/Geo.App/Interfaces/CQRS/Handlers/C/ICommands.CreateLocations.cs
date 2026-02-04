// -----------------------------------------------------------------------
// <copyright file="ICommands.CreateLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Contracts.Handler;
using D2.Geo.Domain.Entities;

public partial interface ICommands
{
    /// <summary>
    /// Handler for creating Locations.
    /// </summary>
    /// <remarks>
    /// Currently not exposed via gRPC - locations are internal to the Geo service.
    /// Retained for potential future external creation or direct internal use.
    /// Note: CreateContacts calls the repository handler directly, not this CQRS handler.
    /// </remarks>
    public interface ICreateLocationsHandler
        : IHandler<CreateLocationsInput, CreateLocationsOutput>;

    /// <summary>
    /// Input for creating Locations.
    /// </summary>
    ///
    /// <param name="Locations">
    /// The locations to be created.
    /// </param>
    public record CreateLocationsInput(List<Location> Locations);

    /// <summary>
    /// Output for creating Locations.
    /// </summary>
    ///
    /// <param name="Data">
    /// The list of created Location entities.
    /// </param>
    public record CreateLocationsOutput(List<Location> Data);
}
