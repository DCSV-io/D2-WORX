// -----------------------------------------------------------------------
// <copyright file="CheckHealth.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Implementations.CQRS.Handlers.Q;

using D2.Shared.Handler;
using D2.Shared.Result;

using ComponentHealth = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.ComponentHealth;
using H = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.ICheckHealthHandler;
using I = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.CheckHealthInput;
using O = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries.CheckHealthOutput;
using ReadCache = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead;
using ReadRepo = D2.Geo.App.Interfaces.Repository.Handlers.R.IRead;

/// <summary>
/// Handler for checking the overall health of the Geo service by aggregating
/// the results of individual component ping handlers.
/// </summary>
public class CheckHealth : BaseHandler<H, I, O>, H
{
    private readonly ReadRepo.IPingDbHandler r_pingDb;
    private readonly ReadCache.IPingHandler r_pingCache;

    /// <summary>
    /// Initializes a new instance of the <see cref="CheckHealth"/> class.
    /// </summary>
    ///
    /// <param name="pingDb">
    /// The database ping handler.
    /// </param>
    /// <param name="pingCache">
    /// The distributed cache ping handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public CheckHealth(
        ReadRepo.IPingDbHandler pingDb,
        ReadCache.IPingHandler pingCache,
        IHandlerContext context)
        : base(context)
    {
        r_pingDb = pingDb;
        r_pingCache = pingCache;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var components = new Dictionary<string, ComponentHealth>();

        // Run DB and cache pings in parallel.
        // Convert to Task once — ValueTask must not be awaited more than once.
        var dbTask = r_pingDb.HandleAsync(new ReadRepo.PingDbInput(), ct).AsTask();
        var cacheTask = r_pingCache.HandleAsync(new ReadCache.PingInput(), ct).AsTask();

        await Task.WhenAll(dbTask, cacheTask);

        var dbResult = await dbTask;
        if (dbResult.Data is not null)
        {
            components["db"] = new ComponentHealth(
                dbResult.Data.Healthy ? "healthy" : "unhealthy",
                dbResult.Data.LatencyMs,
                dbResult.Data.Error);
        }
        else
        {
            components["db"] = new ComponentHealth("unhealthy", null, "Ping handler returned no data");
        }

        var cacheResult = await cacheTask;
        if (cacheResult.Data is not null)
        {
            components["cache"] = new ComponentHealth(
                cacheResult.Data.Healthy ? "healthy" : "unhealthy",
                cacheResult.Data.LatencyMs,
                cacheResult.Data.Error);
        }
        else
        {
            components["cache"] = new ComponentHealth("unhealthy", null, "Ping handler returned no data");
        }

        var allHealthy = components.Values.All(c => c.Status == "healthy");
        var status = allHealthy ? "healthy" : "degraded";

        return D2Result<O?>.Ok(new O(status, components));
    }
}
