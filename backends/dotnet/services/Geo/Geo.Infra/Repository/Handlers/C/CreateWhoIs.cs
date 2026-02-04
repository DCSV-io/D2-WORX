// -----------------------------------------------------------------------
// <copyright file="CreateWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.C;

using D2.Contracts.Batch.Pg;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.ICreateWhoIsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateWhoIsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate.CreateWhoIsOutput;

/// <summary>
/// Handler for creating WhoIs records in the database.
/// </summary>
///
/// <remarks>
/// Since WhoIs records are content-addressable, this performs an upsert:
/// existing records (by hash ID) are skipped, new ones are inserted.
/// </remarks>
public class CreateWhoIs : BaseHandler<CreateWhoIs, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateWhoIs"/> class.
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
    public CreateWhoIs(
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
        if (input.WhoIsRecords.Count == 0)
        {
            return D2Result<O?>.Ok(new O(0), traceId: TraceId);
        }

        // Get all hash IDs from input.
        var inputHashIds = input.WhoIsRecords
            .Select(w => w.HashId)
            .ToList();

        // Find which ones already exist using batched query.
        var existingRecords = await r_db.WhoIsRecords
            .BatchGetByIds(
                inputHashIds,
                w => w.HashId,
                opts => opts.BatchSize = r_options.RepoQueryBatchSize)
            .ToDictionaryAsync(ct);

        // Filter to only new records (not already in database) and deduplicate by HashId.
        var newRecords = input.WhoIsRecords
            .Where(w => !existingRecords.ContainsKey(w.HashId))
            .DistinctBy(w => w.HashId)
            .ToList();

        // If there are new records, insert them.
        if (newRecords.Count > 0)
        {
            r_db.WhoIsRecords.AddRange(newRecords);
            await r_db.SaveChangesAsync(ct);
        }

        return D2Result<O?>.Ok(new O(newRecords.Count), traceId: TraceId);
    }
}
