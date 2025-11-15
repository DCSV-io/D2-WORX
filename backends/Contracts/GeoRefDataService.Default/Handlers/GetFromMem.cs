// -----------------------------------------------------------------------
// <copyright file="GetFromMem.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.Handlers;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.MemoryCacheService;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using H = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.IGetFromMemHandler;
using I = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.GetFromMemInput;
using O = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.GetFromMemOutput;

/// <summary>
/// Handler for getting georeference data from memory cache.
/// </summary>
public class GetFromMem : BaseHandler<GetFromMem, I, O>, H
{
    private readonly IMemoryCacheService.IGetHandler<GetReferenceDataResponse> r_memoryCacheGet;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetFromMem"/> class.
    /// </summary>
    ///
    /// <param name="memoryCacheGet">
    /// The memory cache get handler.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetFromMem(
        IMemoryCacheService.IGetHandler<GetReferenceDataResponse> memoryCacheGet,
        IHandlerContext context)
        : base(context)
    {
        r_memoryCacheGet = memoryCacheGet;
    }

    /// <summary>
    /// Executes the handler to get georeference data from memory cache.
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
        const string cache_key = "GeoRefData";

        var getR = await r_memoryCacheGet.HandleAsync(new(cache_key), ct);

        if (getR.CheckSuccess(out var output))
        {
            return D2Result<O?>.Ok(new(output!.Value!), traceId: TraceId);
        }

        return D2Result<O?>.NotFound(traceId: TraceId);
    }
}
