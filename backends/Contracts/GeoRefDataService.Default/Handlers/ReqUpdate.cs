// -----------------------------------------------------------------------
// <copyright file="ReqUpdate.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.Handlers;

using System.Net;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using H = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.IReqUpdateHandler;
using I = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.ReqUpdateInput;
using O = D2.Contracts.Interfaces.GeoRefDataService.IGeoRefDataService.ReqUpdateOutput;

/// <summary>
/// Handler for requesting a reference data update from the Geo service.
/// </summary>
public class ReqUpdate : BaseHandler<ReqUpdate, I, O>, H
{
    private readonly GeoService.GeoServiceClient r_geoClient;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReqUpdate"/> class.
    /// </summary>
    ///
    /// <param name="geoClient">
    /// The Geo service gRPC client.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public ReqUpdate(
        GeoService.GeoServiceClient geoClient,
        IHandlerContext context)
        : base(context)
    {
        r_geoClient = geoClient;
    }

    /// <summary>
    /// Executes the handler to request a reference data update.
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
    /// The result of the request operation.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        try
        {
            var response = await r_geoClient.RequestReferenceDataUpdateAsync(
                new RequestReferenceDataUpdateRequest(),
                cancellationToken: ct);

            return response.Accepted
                ? D2Result<O?>.Ok(new O(), traceId: TraceId)
                : D2Result<O?>.Fail(
                    ["Update request was not accepted."],
                    HttpStatusCode.ServiceUnavailable,
                    errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                    traceId: TraceId);
        }
        catch (RpcException ex)
        {
            Context.Logger.LogError(
                ex,
                "RpcException occurred while requesting reference data update. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Fail(
                ["Unable to reach Geo service."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                traceId: TraceId);
        }
    }
}
