// -----------------------------------------------------------------------
// <copyright file="SetInMem.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.Handlers;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.MemoryCacheService;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using H = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.ISetInMemHandler;
using I = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.SetInMemInput;
using O = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.SetInMemOutput;

/// <summary>
/// Handler for setting georeference data in the in-memory cache.
/// </summary>
public class SetInMem : BaseHandler<SetInMem, I, O>, H
{
    private readonly IMemoryCacheService.ISetHandler<GetReferenceDataResponse> r_memoryCacheSet;

    /// <summary>
    /// Initializes a new instance of the <see cref="SetInMem"/> class.
    /// </summary>
    ///
    /// <param name="memoryCacheSet">
    /// The memory cache set handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public SetInMem(
        IMemoryCacheService.ISetHandler<GetReferenceDataResponse> memoryCacheSet,
        IHandlerContext context)
        : base(context)
    {
        r_memoryCacheSet = memoryCacheSet;
    }

    /// <summary>
    /// Executes the handler to set georeference data in the in-memory cache.
    /// </summary>
    ///
    /// <param name="input">
    /// The input parameters for the handler.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// The result of the set operation.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        const string cache_key = "GeoRefData";

        var setR = await r_memoryCacheSet.HandleAsync(
            new(cache_key, input.Data, null),
            ct);

        return setR.Success
            ? D2Result<O?>.Ok(traceId: TraceId)
            : D2Result<O?>.BubbleFail(setR);
    }
}
