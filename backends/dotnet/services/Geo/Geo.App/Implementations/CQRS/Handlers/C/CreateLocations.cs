// -----------------------------------------------------------------------
// <copyright file="CreateLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.C;

using D2.Geo.App.Validators;
using D2.Shared.Handler;
using D2.Shared.Result;
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
        if (input.Locations.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Validate each location.
        List<List<string>> allErrors = [];
        for (var i = 0; i < input.Locations.Count; i++)
        {
            var validator = new LocationValidator($"items[{i}].");
            var validationResult = await validator.ValidateAsync(input.Locations[i], ct);
            if (!validationResult.IsValid)
            {
                allErrors.AddRange(validationResult.Errors
                    .GroupBy(e => e.PropertyName)
                    .Select(g => new List<string> { g.Key }
                        .Concat(g.Select(e => e.ErrorMessage))
                        .ToList()));
            }
        }

        if (allErrors.Count > 0)
        {
            return D2Result<O?>.BubbleFail(
                D2Result.ValidationFailed(inputErrors: allErrors, traceId: TraceId));
        }

        // Create in repository.
        var repoR = await r_createLocationsInRepo.HandleAsync(new(input.Locations), ct);

        if (repoR.CheckFailure(out _))
        {
            return D2Result<O?>.BubbleFail(repoR);
        }

        // Return the created locations.
        return D2Result<O?>.Ok(new O(input.Locations), traceId: TraceId);
    }
}
