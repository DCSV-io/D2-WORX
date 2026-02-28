// -----------------------------------------------------------------------
// <copyright file="DeleteStaleWhoIs.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.D;

using D2.Shared.Batch.Pg;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.IDeleteStaleWhoIsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteStaleWhoIsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteStaleWhoIsOutput;

/// <summary>
/// Deletes WhoIs records older than a given cutoff year/month.
/// Uses <see cref="BatchDelete"/> for chunked deletion to avoid long transactions.
/// Batch size is configured via <see cref="GeoInfraOptions.RepoBatchSize"/>.
/// </summary>
/// <remarks>
/// Staleness criteria: <c>(Year &lt; cutoffYear) OR (Year = cutoffYear AND Month &lt; cutoffMonth)</c>.
/// </remarks>
public class DeleteStaleWhoIs : BaseHandler<DeleteStaleWhoIs, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_infraOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteStaleWhoIs"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The Geo database context.
    /// </param>
    /// <param name="infraOptions">
    /// Infrastructure options (includes batch size).
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public DeleteStaleWhoIs(
        GeoDbContext db,
        IOptions<GeoInfraOptions> infraOptions,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
        r_infraOptions = infraOptions.Value;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var deleted = await BatchDelete.ExecuteAsync(
            async (batchSize, token) =>
                await r_db.WhoIsRecords
                    .Where(w =>
                        w.Year < input.CutoffYear ||
                        (w.Year == input.CutoffYear && w.Month < input.CutoffMonth))
                    .Take(batchSize)
                    .Select(w => w.HashId)
                    .ToListAsync(token),
            async (ids, token) =>
                await r_db.WhoIsRecords
                    .Where(w => ids.Contains(w.HashId))
                    .ExecuteDeleteAsync(token),
            r_infraOptions.RepoBatchSize,
            ct);

        return D2Result<O?>.Ok(new O(deleted));
    }
}
