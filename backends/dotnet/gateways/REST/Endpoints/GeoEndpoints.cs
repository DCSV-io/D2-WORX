// -----------------------------------------------------------------------
// <copyright file="GeoEndpoints.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Endpoints;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Utilities.Extensions;

/// <summary>
/// Defines the Geo-service related API endpoints.
/// </summary>
public static class GeoEndpoints
{
    /// <summary>
    /// Extension methods for the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to extend.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds a gRPC client for the Geo service to the service collection.
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoGrpcClient(IConfiguration configuration)
        {
            const string config_key = "services:d2-geo:http:0";
            var geoAddress = configuration[config_key];
            if (geoAddress.Falsey())
            {
                throw new ArgumentException(
                    $"Geo service address not configured. Missing '{config_key}' configuration.");
            }

            services.AddGrpcClient<GeoService.GeoServiceClient>(o =>
            {
                o.Address = new Uri(geoAddress!);
            });

            return services;
        }
    }

    /// <summary>
    /// Extension methods for the endpoint route builder.
    /// </summary>
    ///
    /// <param name="erb">
    /// The endpoint route builder to extend.
    /// </param>
    extension(IEndpointRouteBuilder erb)
    {
        /// <summary>
        /// Maps the Geo-service related REST API endpoints.
        /// </summary>
        ///
        /// <returns>
        /// The updated endpoint route builder.
        /// </returns>
        public IEndpointRouteBuilder MapGeoEndpointsV1()
        {
            // Map Geo-service endpoints under /api/v1/geo.
            var group = erb.MapGroup("/api/v1/geo");

            // Map endpoint to get full geographic reference data.
            group.MapGet("/reference-data", GetReferenceDataAsync)
                .WithName("GetGeoReferenceData")
                .WithSummary("Returns full geographic reference data.")
                .WithDescription(
                    "Retrieves countries, subdivisions, currencies, languages, locales, and geopolitical entities.");

            // Map endpoint to request geographic reference data update.
            group.MapPost("/reference-data/update", RequestReferenceDataUpdateAsync)
                .WithName("RequestGetGeoReferenceDataUpdate")
                .WithSummary("Requests that the geographic reference data be updated.")
                .WithDescription(
                    "Requests that the geographic reference data be updated. Returns the current version of geographic reference data.");

            // Return the updated endpoint route builder.
            return erb;
        }
    }

    /// <summary>
    /// Handles the GET /reference-data endpoint.
    /// </summary>
    ///
    /// <param name="geoClient">
    /// The Geo service gRPC client.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// An <see cref="IResult"/> representing the HTTP response.
    /// </returns>
    private static async Task<IResult> GetReferenceDataAsync(
        GeoService.GeoServiceClient geoClient,
        CancellationToken ct)
    {
        var response = await geoClient.GetReferenceDataAsync(
            new GetReferenceDataRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }

    /// <summary>
    /// Handles the POST /reference-data/update endpoint.
    /// </summary>
    ///
    /// <param name="geoClient">
    /// The Geo service gRPC client.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    /// <returns>
    /// An <see cref="IResult"/> representing the HTTP response.
    /// </returns>
    private static async Task<IResult> RequestReferenceDataUpdateAsync(
        GeoService.GeoServiceClient geoClient,
        CancellationToken ct)
    {
        var response = await geoClient.RequestReferenceDataUpdateAsync(
            new RequestReferenceDataUpdateRequest(),
            cancellationToken: ct);

        return response.Result.ToHttpResult(response.Data);
    }
}
