// -----------------------------------------------------------------------
// <copyright file="GetLocationsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Contracts.Batch.Pg;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.Domain.Entities;
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
        var result = await r_db.Locations
            .BatchGetByIds(
                input.LocationHashIds,
                l => l.HashId,
                opts => opts.BatchSize = r_options.RepoQueryBatchSize)
            .ToDictionaryD2ResultAsync(TraceId, ct);

        if (result.CheckFailure(out var locations))
        {
            return D2Result<O?>.BubbleFail(result);
        }

        return D2Result<O?>.Ok(new O(locations!), traceId: TraceId);
    }
}
