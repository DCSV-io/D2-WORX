// -----------------------------------------------------------------------
// <copyright file="CreateLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.C;

using D2.Shared.Batch.Pg;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.ICreateLocationsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateLocationsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateLocationsOutput;

/// <summary>
/// Handler for creating locations in the database.
/// </summary>
///
/// <remarks>
/// Since locations are content-addressable, this performs an upsert:
/// existing locations (by hash ID) are skipped, new ones are inserted.
/// </remarks>
public class CreateLocations : BaseHandler<CreateLocations, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateLocations"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The database context.
    /// </param>
    /// <param name="options">
    /// The infrastructure options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CreateLocations(
        GeoDbContext db,
        IOptions<GeoInfraOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
        r_options = options.Value;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // If the request was empty, return early.
        if (input.Locations.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0), traceId: TraceId);
        }

        // Get all hash IDs from input.
        var inputHashIds = input.Locations
            .Select(l => l.HashId)
            .ToList();

        // Find which ones already exist using batched query.
        var existingLocations = await r_db.Locations
            .BatchGetByIds(
                inputHashIds,
                l => l.HashId,
                opts => opts.BatchSize = r_options.RepoQueryBatchSize)
            .ToDictionaryAsync(ct);

        // Filter to only new locations (not already in database) and deduplicate by HashId.
        var newLocations = input.Locations
            .Where(l => !existingLocations.ContainsKey(l.HashId))
            .DistinctBy(l => l.HashId)
            .ToList();

        // If there are new locations, insert them.
        if (newLocations.Count > 0)
        {
            r_db.Locations.AddRange(newLocations);
            await r_db.SaveChangesAsync(ct);
        }

        return D2Result<O?>.Ok(new O(newLocations.Count), traceId: TraceId);
    }
}
