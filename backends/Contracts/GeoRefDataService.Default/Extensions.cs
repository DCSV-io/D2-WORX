// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default;

using D2.Contracts.GeoRefDataService.Default.Handlers;
using D2.Contracts.Interfaces.GeoRefDataService;
using D2.Services.Protos.Geo.V1;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding GeoRefDataService handlers.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds GeoRefDataService handlers for consumer services.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds GeoRefDataService consumer handlers including gRPC client.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The configuration containing the Geo service URL.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoRefDataConsumer(IConfiguration configuration)
        {
            // Register gRPC client for Geo service
            services.AddGrpcClient<GeoService.GeoServiceClient>(o =>
            {
                o.Address = new Uri(configuration["GeoService:Url"] ?? "http://geo-service");
            });

            // Register all handlers
            services.AddTransient<IGeoRefDataService.IGetHandler, Get>();
            services.AddTransient<IGeoRefDataService.IGetFromMemHandler, GetFromMem>();
            services.AddTransient<IGeoRefDataService.IGetFromDistHandler, GetFromDist>();
            services.AddTransient<IGeoRefDataService.IGetFromDiskHandler, GetFromDisk>();
            services.AddTransient<IGeoRefDataService.ISetInMemHandler, SetInMem>();
            services.AddTransient<IGeoRefDataService.ISetOnDiskHandler, SetOnDisk>();
            services.AddTransient<IGeoRefDataService.IReqUpdateHandler, ReqUpdate>();

            return services;
        }

        /// <summary>
        /// Adds GeoRefDataService provider handlers (for Geo service itself).
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoRefDataProvider()
        {
            // Register handlers except Get and ReqUpdate (Geo service implements these
            // differently).
            services.AddTransient<IGeoRefDataService.IGetFromMemHandler, GetFromMem>();
            services.AddTransient<IGeoRefDataService.IGetFromDistHandler, GetFromDist>();
            services.AddTransient<IGeoRefDataService.IGetFromDiskHandler, GetFromDisk>();
            services.AddTransient<IGeoRefDataService.ISetInMemHandler, SetInMem>();
            services.AddTransient<IGeoRefDataService.ISetOnDiskHandler, SetOnDisk>();

            return services;
        }
    }
}
