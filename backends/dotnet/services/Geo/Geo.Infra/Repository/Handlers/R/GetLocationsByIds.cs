// -----------------------------------------------------------------------
// <copyright file="GetLocationsByIds.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.R;

using D2.Shared.Batch.Pg;
using D2.Shared.Handler;
using D2.Shared.Result;
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
                opts => opts.BatchSize = r_options.RepoBatchSize)
            .ToDictionaryD2ResultAsync(TraceId, ct);

        // Handle success case first.
        if (result.Success)
        {
            return D2Result<O?>.Ok(new O(result.Data!));
        }

        // Handle partial success and not found - these have specific semantics.
        // For any other errors, bubble up the failure.
        return result.ErrorCode switch
        {
            ErrorCodes.SOME_FOUND => D2Result<O?>.SomeFound(new O(result.Data!)),
            ErrorCodes.NOT_FOUND => D2Result<O?>.NotFound(),
            _ => D2Result<O?>.BubbleFail(result),
        };
    }
}
