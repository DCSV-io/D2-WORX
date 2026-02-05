// -----------------------------------------------------------------------
// <copyright file="Updated.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Client.Messaging.Handlers.Sub;

using D2.Geo.Client.Interfaces.CQRS.Handlers.C;
using D2.Geo.Client.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using H = D2.Geo.Client.Interfaces.Messaging.Handlers.Sub.ISubs.IUpdatedHandler;
using I = D2.Geo.Client.Messages.GeoRefDataUpdated;
using O = D2.Geo.Client.Interfaces.Messaging.Handlers.Sub.ISubs.UpdatedOutput;

/// <summary>
/// Messaging subscription handler for geographic reference data updated notifications.
/// </summary>
public class Updated : BaseHandler<Updated, I, O>, H
{
    private readonly IComplex.IGetHandler r_getHandler;
    private readonly IQueries.IGetFromDistHandler r_getFromDist;
    private readonly ICommands.ISetInMemHandler r_setInMem;
    private readonly ICommands.ISetOnDiskHandler r_setOnDisk;

    /// <summary>
    /// Initializes a new instance of the <see cref="Updated"/> class.
    /// </summary>
    ///
    /// <param name="getHandler">
    /// The get handler.
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
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Updated(
        IComplex.IGetHandler getHandler,
        IQueries.IGetFromDistHandler getFromDist,
        ICommands.ISetInMemHandler setInMem,
        ICommands.ISetOnDiskHandler setOnDisk,
        IHandlerContext context)
        : base(context)
    {
        r_getHandler = getHandler;
        r_getFromDist = getFromDist;
        r_setInMem = setInMem;
        r_setOnDisk = setOnDisk;
    }

    /// <summary>
    /// Executes the handler logic asynchronously.
    /// </summary>
    ///
    /// <param name="input">
    /// The input message.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> with the output of the
    /// handler.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        // Check if the current data is up to date.
        var getR = await r_getHandler.HandleAsync(new(), ct);
        var isUpToDate = getR.Success && getR.Data!.Data.Version == input.Version;

        // If it is, return OK.
        if (isUpToDate)
        {
            return D2Result<O?>.Ok(new O(), traceId: TraceId);
        }

        // If not, get the updated data from the distributed cache.
        var distR = await r_getFromDist.HandleAsync(new(), ct);
        if (distR.CheckFailure(out var output))
        {
            // If not found in distributed cache, log and return NotFound.
            Context.Logger.LogError(
                "Failed to get data from dist cache after update message. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.NotFound(traceId: TraceId);
        }

        var data = output!.Data;

        // Otherwise, update the in memory.
        var setInMemR = await r_setInMem.HandleAsync(new(data), ct);
        if (setInMemR.Failed)
        {
            // Log the error but continue.
            Context.Logger.LogError(
                "Failed to set data in memory cache after update message. TraceId: {TraceId}",
                TraceId);
        }

        // And on disk.
        var setOnDiskR = await r_setOnDisk.HandleAsync(new(data), ct);
        if (setOnDiskR.Failed)
        {
            // Log the error but continue.
            Context.Logger.LogError(
                "Failed to set data on disk after update message. TraceId: {TraceId}",
                TraceId);
        }

        // Return OK.
        return D2Result<O?>.Ok(new O(), traceId: TraceId);
    }
}
