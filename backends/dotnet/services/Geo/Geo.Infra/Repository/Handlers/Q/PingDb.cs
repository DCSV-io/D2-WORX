// -----------------------------------------------------------------------
// <copyright file="PingDb.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra.Repository.Handlers.Q;

using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

using H = D2.Geo.App.Interfaces.Repository.Handlers.Q.IRead.IPingDbHandler;
using I = D2.Geo.App.Interfaces.Repository.Handlers.Q.IRead.PingDbInput;
using O = D2.Geo.App.Interfaces.Repository.Handlers.Q.IRead.PingDbOutput;

/// <summary>
/// Handler for pinging the Geo database to verify connectivity.
/// </summary>
public class PingDb : BaseHandler<H, I, O>, H
{
    private readonly GeoDbContext r_db;

    /// <summary>
    /// Initializes a new instance of the <see cref="PingDb"/> class.
    /// </summary>
    ///
    /// <param name="db">
    /// The Geo database context.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public PingDb(
        GeoDbContext db,
        IHandlerContext context)
        : base(context)
    {
        r_db = db;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await r_db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
            sw.Stop();

            return D2Result<O?>.Ok(
                new O(true, sw.ElapsedMilliseconds, null));
        }
        catch (Exception ex)
        {
            sw.Stop();
            Context.Logger.LogError(
                ex,
                "Database ping failed. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Ok(
                new O(false, sw.ElapsedMilliseconds, ex.Message));
        }
    }
}
