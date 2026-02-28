// -----------------------------------------------------------------------
// <copyright file="DeleteOrphanedLocations.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.D;

using D2.Shared.Batch.Pg;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using H = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.IDeleteOrphanedLocationsHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteOrphanedLocationsInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.D.IDelete.DeleteOrphanedLocationsOutput;

/// <summary>
/// Deletes locations with zero contact and zero WhoIs references.
/// Uses <see cref="BatchDelete"/> for chunked deletion to avoid long transactions.
/// Batch size is configured via <see cref="GeoInfraOptions.RepoBatchSize"/>.
/// </summary>
public class DeleteOrphanedLocations : BaseHandler<DeleteOrphanedLocations, I, O>, H
{
    private readonly GeoDbContext r_db;
    private readonly GeoInfraOptions r_infraOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteOrphanedLocations"/> class.
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
    public DeleteOrphanedLocations(
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
                await r_db.Locations
                    .Where(l =>
                        !r_db.Contacts.Any(c => c.LocationHashId == l.HashId) &&
                        !r_db.WhoIsRecords.Any(w => w.LocationHashId == l.HashId))
                    .Take(batchSize)
                    .Select(l => l.HashId)
                    .ToListAsync(token),
            async (ids, token) =>
                await r_db.Locations
                    .Where(l => ids.Contains(l.HashId))
                    .ExecuteDeleteAsync(token),
            r_infraOptions.RepoBatchSize,
            ct);

        return D2Result<O?>.Ok(new O(deleted));
    }
}
