// -----------------------------------------------------------------------
// <copyright file="GetLocationsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.IGetLocationsByIdsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetLocationsByIdInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead.GetLocationsByIdOutput;

/// <summary>
/// Handler for getting locations by their IDs from the database.
/// </summary>
public class GetLocationsByIds : BaseHandler<GetLocationsByIds, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetLocationsByIds"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The database context.
    /// </param>
    /// <param name="options">
    /// The Geo infrastructure options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetLocationsByIds(
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
        if (input.LocationHashIds.Count == 0)
        {
            return D2Result<O?>.Ok(new O([]), traceId: TraceId);
        }

        // Query in batches to avoid large IN clause issues.
        var locations = new Dictionary<string, Location>();

        foreach (var batch in input.LocationHashIds.Chunk(r_options.RepoQueryBatchSize))
        {
            var batchList = batch.ToList();
            var batchResults = await r_db.Locations
                .AsNoTracking()
                .Where(l => batchList.Contains(l.HashId))
                .ToListAsync(ct);

            foreach (var location in batchResults)
            {
                locations[location.HashId] = location;
            }
        }

        // If none were found, return NOT_FOUND.
        if (locations.Count == 0)
        {
            return D2Result<O?>.NotFound(traceId: TraceId);
        }

        // If some were found but not all, return SOME_FOUND.
        if (locations.Count < input.LocationHashIds.Count)
        {
            return D2Result<O?>.SomeFound(new O(locations), traceId: TraceId);
        }

        // All were found, return success.
        return D2Result<O?>.Ok(new O(locations), traceId: TraceId);
    }
}
