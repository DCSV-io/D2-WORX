// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Infra;

using D2.Geo.Infra.Repository.Handlers.R;
using global::D2.Geo.App.Interfaces.Repository.R;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding Geo infrastructure services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds Geo infrastructure handlers to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds Geo infrastructure handlers.
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddGeoInfra()
        {
            // Repository (read) handlers.
            services.AddTransient<IGeoReadRepo.IGetReferenceDataHandler, GetReferenceData>();

            return services;
        }
    }
}
