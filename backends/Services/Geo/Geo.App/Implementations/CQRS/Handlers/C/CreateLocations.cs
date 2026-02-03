// -----------------------------------------------------------------------
// <copyright file="CreateLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Mappers;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.ICreateLocationsHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateLocationsInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands.CreateLocationsOutput;

/// <summary>
/// Handler for creating Locations.
/// </summary>
public class CreateLocations : BaseHandler<CreateLocations, I, O>, H
{
    private readonly CreateRepo.ICreateLocationsHandler r_createLocationsInRepo;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateLocations"/> class.
    /// </summary>
    ///
    /// <param name="createLocationsInRepo">
    /// The repository handler for creating Locations.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateLocations(
        CreateRepo.ICreateLocationsHandler createLocationsInRepo,
        IHandlerContext context)
        : base(context)
    {
        r_createLocationsInRepo = createLocationsInRepo;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Request.LocationsToCreate.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Convert DTOs to domain entities.
        var locations = input.Request.LocationsToCreate
            .Select(dto => dto.ToDomain())
            .ToList();

        // Create in repository.
        var repoR = await r_createLocationsInRepo.HandleAsync(new(locations), ct);

        if (repoR.CheckFailure(out _))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Return the created locations as DTOs.
        var dtos = locations.Select(l => l.ToDTO()).ToList();
        return D2Result<O?>.Ok(new O(dtos), traceId: TraceId);
    }
}
