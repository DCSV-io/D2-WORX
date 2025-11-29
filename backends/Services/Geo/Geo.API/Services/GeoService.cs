// -----------------------------------------------------------------------
// <copyright file="GeoService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.API.Services;

using D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.X;
using D2.Contracts.Result.Extensions;
using D2.Services.Protos.Geo.V1;
using Grpc.Core;
using SB = D2.Services.Protos.Geo.V1.GeoService.GeoServiceBase;

/// <summary>
/// Provides geographical reference data services.
/// </summary>
public class GeoService : SB
{
    private readonly IComplex.IGetHandler r_get;

    /// <summary>
    /// Initializes a new instance of the <see cref="GeoService"/> class.
    /// </summary>
    ///
    /// <param name="get">
    /// The handler for getting geographic reference data.
    /// </param>
    public GeoService(
        IComplex.IGetHandler get)
    {
        r_get = get;
    }

    /// <inheritdoc/>
    public override async Task<GetReferenceDataResponse> GetReferenceData(
        GetReferenceDataRequest request,
        ServerCallContext context)
    {
        var result = await r_get.HandleAsync(new(), context.CancellationToken);

        return new GetReferenceDataResponse
        {
            Result = result.ToProto(),
            Data = result.Success ? result.Data!.Data : null,
        };
    }

    /// <inheritdoc/>
    public override async Task<RequestReferenceDataUpdateResponse> RequestReferenceDataUpdate(
        RequestReferenceDataUpdateRequest request,
        ServerCallContext context)
    {
        var result = await r_get.HandleAsync(new(), context.CancellationToken);

        return new RequestReferenceDataUpdateResponse
        {
            Result = result.ToProto(),
            Data = result.Success
                ? new RequestReferenceDataUpdateData { Version = result.Data!.Data.Version }
                : null,
        };
    }
}
