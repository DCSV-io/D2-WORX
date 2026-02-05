// -----------------------------------------------------------------------
// <copyright file="Get.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.CQRS.Handlers.X;

using D2.Geo.Client.Interfaces.CQRS.Handlers.C;
using D2.Geo.Client.Interfaces.CQRS.Handlers.Q;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using H = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.IGetHandler;
using I = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.GetInput;
using O = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex.GetOutput;

/// <summary>
/// Handler for getting georeference data.
/// </summary>
/// <remarks>
/// This implementation is meant for consumer services only.
/// </remarks>
public class Get : BaseHandler<Get, I, O>, H
{
    private readonly IQueries.IGetFromMemHandler r_getFromMem;
    private readonly IQueries.IGetFromDistHandler r_getFromDist;
    private readonly ICommands.ISetInMemHandler r_setInMem;
    private readonly ICommands.ISetOnDiskHandler r_setOnDisk;
    private readonly IQueries.IGetFromDiskHandler r_getFromDisk;
    private readonly ICommands.IReqUpdateHandler r_requestUpdate;

    /// <summary>
    /// Initializes a new instance of the <see cref="Get"/> class.
    /// </summary>
    ///
    /// <param name="getFromMem">
    /// The get from in-memory cache handler.
    /// </param>
    /// <param name="getFromDist">
    /// The get from distributed cache handler.
    /// </param>
    /// <param name="setInMem">
    /// The set in-memory cache handler.
    /// </param>
    /// <param name="setOnDisk">
    /// The set on-disk handler.
    /// </param>
    /// <param name="getFromDisk">
    /// The get from disk handler.
    /// </param>
    /// <param name="requestUpdate">
    /// The request update handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Get(
        IQueries.IGetFromMemHandler getFromMem,
        IQueries.IGetFromDistHandler getFromDist,
        ICommands.ISetInMemHandler setInMem,
        ICommands.ISetOnDiskHandler setOnDisk,
        IQueries.IGetFromDiskHandler getFromDisk,
        ICommands.IReqUpdateHandler requestUpdate,
        IHandlerContext context)
        : base(context)
    {
        r_getFromMem = getFromMem;
        r_setInMem = setInMem;
        r_setOnDisk = setOnDisk;
        r_getFromDist = getFromDist;
        r_getFromDisk = getFromDisk;
        r_requestUpdate = requestUpdate;
    }

    /// <summary>
    /// Gets the georeference data.
    /// </summary>
    ///
    /// <param name="input">
    /// The get input.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> the georeference data
    /// if found; otherwise, NotFound.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // Retry logic: 6 attempts with exponential backoff delays (1s, 2s, 4s, 8s, 16s).
        // Total time: ~31 seconds.
        const int max_attempts = 6;

        for (var attempt = 1; attempt <= max_attempts; attempt++)
        {
            var result = await GetAttempt(ct);
            if (result.Success)
            {
                return result;
            }

            // Delay before next attempt (except after last attempt).
            if (attempt < max_attempts)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
                await Task.Delay(delay, ct);
            }
        }

        return D2Result<O?>.NotFound(traceId: TraceId);
    }

    /// <summary>
    /// Attempts to get the georeference data from various sources.
    /// </summary>
    ///
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> the georeference data
    /// if found; otherwise, NotFound.
    /// </returns>
    private async ValueTask<D2Result<O?>> GetAttempt(
        CancellationToken ct)
    {
        // First, try to get the data from in-memory cache.
        var memoryR = await r_getFromMem.HandleAsync(new(), ct);
        if (memoryR.CheckSuccess(out var memoryOutput))
        {
            // If successful, return the data.
            return D2Result<O?>.Ok(new O(memoryOutput!.Data), traceId: TraceId);
        }

        // If that fails, try to get it from distributed cache.
        var distR = await r_getFromDist.HandleAsync(new(), ct);
        if (distR.CheckSuccess(out var distOutput))
        {
            var data = distOutput!.Data;

            // If successful, store it locally.
            await SetInMemoryAndOnDiskAsync(data, ct);

            // Then return the data.
            return D2Result<O?>.Ok(new O(data), traceId: TraceId);
        }

        // If that failed, tell the Geo service to update the distributed cache.
        var updateR = await r_requestUpdate.HandleAsync(new(), ct);
        if (updateR.Failed)
        {
            // If we failed to reach the Geo service, log an error.
            Context.Logger.LogError(
                "Failed to request update of georeference data (consumer). TraceId: {TraceId}",
                TraceId);
        }

        // Then try to get it from disk.
        var diskR = await r_getFromDisk.HandleAsync(new(), ct);
        if (diskR.CheckSuccess(out var diskOutput))
        {
            var data = diskOutput!.Data;

            // If successful, store it in memory cache.
            var setInMemR = await r_setInMem.HandleAsync(new(data), ct);
            if (setInMemR.Failed)
            {
                Context.Logger.LogError(
                    "Failed to set data in memory cache (consumer). TraceId: {TraceId}",
                    TraceId);
            }

            // Then return the data.
            return D2Result<O?>.Ok(new O(data), traceId: TraceId);
        }

        // If all attempts failed, return NotFound.
        return D2Result<O?>.NotFound(traceId: TraceId);
    }

    /// <summary>
    /// Sets the georeference data in both in-memory and on-disk.
    /// </summary>
    ///
    /// <param name="data">
    /// The georeference data.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    private async ValueTask SetInMemoryAndOnDiskAsync(
        GeoRefData data,
        CancellationToken ct)
    {
        var setInMemR = await r_setInMem.HandleAsync(new(data), ct);
        if (setInMemR.Failed)
        {
            Context.Logger.LogError(
                "Failed to set data in memory cache (consumer). TraceId: {TraceId}",
                TraceId);
        }

        var setOnDiskR = await r_setOnDisk.HandleAsync(new(data), ct);
        if (setOnDiskR.Failed)
        {
            Context.Logger.LogError(
                "Failed to set data on disk (consumer). TraceId: {TraceId}",
                TraceId);
        }
    }
}
