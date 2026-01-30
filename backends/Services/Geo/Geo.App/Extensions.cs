// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App;

using D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.X;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Implementations.CQRS.Handlers.X;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using IQueries = D2.Geo.App.Interfaces.CQRS.Handlers.Q.IQueries;

/// <summary>
/// Extension methods for adding Geo services to the application.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds Geo application handlers to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds Geo application services to the service collection.
        /// </summary>
        ///
        /// <param name="configuration">
        /// The application configuration.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoApp(IConfiguration configuration)
        {
            services.Configure<GeoAppOptions>(configuration.GetSection(nameof(GeoAppOptions)));

            services.AddTransient<IComplex.IGetHandler, Get>();
            services.AddTransient<IQueries.IGetLocationsByIdsHandler, GetLocationsByIds>();

            return services;
        }
    }
}
