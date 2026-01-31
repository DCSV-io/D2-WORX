// -----------------------------------------------------------------------
// <copyright file="ICommands.CreateLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.C;

using D2.Contracts.Handler;
using D2.Services.Protos.Geo.V1;

public partial interface ICommands
{
    /// <summary>
    /// Handler for creating Locations.
    /// </summary>
    public interface ICreateLocationsHandler
        : IHandler<CreateLocationsInput, CreateLocationsOutput>;

    /// <summary>
    /// Input for creating Locations.
    /// </summary>
    ///
    /// <param name="Request">
    /// The request containing the locations to be created.
    /// </param>
    public record CreateLocationsInput(CreateLocationsRequest Request);

    /// <summary>
    /// Output for creating Locations.
    /// </summary>
    ///
    /// <param name="Data">
    /// The list of created LocationDTOs.
    /// </param>
    public record CreateLocationsOutput(List<LocationDTO> Data);
}
