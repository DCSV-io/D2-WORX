// -----------------------------------------------------------------------
// <copyright file="SetInDist.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.CQRS.Handlers.C;

using D2.Contracts.Handler;
using D2.Contracts.Interfaces.Caching.Abstract.Handlers.U;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using Constants = D2.Contracts.Utilities.Constants.Constants;
using H = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.C.ICommands.ISetInDistHandler;
using I = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.C.ICommands.SetInDistInput;
using O = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.C.ICommands.SetInDistOutput;

/// <summary>
/// Handler for setting geographic reference data to a distributed cache.
/// </summary>
public class SetInDist : BaseHandler<SetInDist, I, O>, H
{
    private readonly IUpdate.ISetHandler<GetReferenceDataResponse> r_distCacheSet;

    /// <summary>
    /// Initializes a new instance of the <see cref="SetInDist"/> class.
    /// </summary>
    ///
    /// <param name="distCacheSet">
    /// The distributed cache set handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public SetInDist(
        IUpdate.ISetHandler<GetReferenceDataResponse> distCacheSet,
        IHandlerContext context)
        : base(context)
    {
        r_distCacheSet = distCacheSet;
    }

    /// <summary>
    /// Executes the handler to set geographic reference data to a distributed cache.
    /// </summary>
    ///
    /// <param name="input">
    /// The input containing the geographic reference data.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="ValueTask"/> containing a <see cref="D2Result{O}"/> indicating success or
    /// failure.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var setR = await r_distCacheSet.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA, input.Data),
            ct);

        return setR.Success
            ? D2Result<O?>.Ok(traceId: TraceId)
            : D2Result<O?>.BubbleFail(setR);
    }
}
