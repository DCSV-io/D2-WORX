// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App;

using D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.X;
using D2.Geo.App.Implementations.CQRS.Handlers.X;
using Microsoft.Extensions.DependencyInjection;

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
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoApp()
        {
            services.AddTransient<IComplex.IGetHandler, Get>();

            return services;
        }
    }
}
