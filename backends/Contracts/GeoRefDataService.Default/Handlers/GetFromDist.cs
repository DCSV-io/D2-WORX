// -----------------------------------------------------------------------
// <copyright file="GetFromDist.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.Handlers;

using D2.Contracts.Handler;
using D2.Contracts.Interfaces.DistributedCacheService;
using D2.Contracts.Result;
using D2.Contracts.Utilities.Constants;
using D2.Services.Protos.Geo.V1;

// ReSharper disable AccessToStaticMemberViaDerivedType
using H = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.IGetFromDistHandler;
using I = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.GetFromDistInput;
using O = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.GetFromDistOutput;

/// <summary>
/// Handler for getting georeference data from distributed cache.
/// </summary>
public class GetFromDist : BaseHandler<GetFromDist, I, O>, H
{
    private readonly IDistributedCacheService.IGetHandler<GetReferenceDataResponse> r_distCacheGet;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetFromDist"/> class.
    /// </summary>
    ///
    /// <param name="distCacheGet">
    /// The distributed cache get handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetFromDist(
        IDistributedCacheService.IGetHandler<GetReferenceDataResponse> distCacheGet,
        IHandlerContext context)
        : base(context)
    {
        r_distCacheGet = distCacheGet;
    }

    /// <summary>
    /// Executes the handler to get georeference data from distributed cache.
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
    /// The result of the get operation, containing the georeference data if found.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var getR = await r_distCacheGet.HandleAsync(
            new(Constants.DIST_CACHE_KEY_GEO_REF_DATA),
            ct);

        if (getR.CheckSuccess(out var output))
        {
            return D2Result<O?>.Ok(new(output!.Value!), traceId: TraceId);
        }

        return D2Result<O?>.NotFound(traceId: TraceId);
    }
}
