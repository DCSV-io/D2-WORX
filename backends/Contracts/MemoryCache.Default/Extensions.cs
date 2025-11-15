// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.MemoryCache.Default;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Contracts.Interfaces.MemoryCacheService;
using D2.Contracts.MemoryCache.Default.Handlers;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Extension methods for adding default in-memory caching services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds default in-memory caching services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds default in-memory caching services to the service collection.
        /// </summary>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddDefaultMemoryCaching()
        {
            services.AddMemoryCache();

            // The handlers for in-memory cache operations.
            services.AddTransient(typeof(IMemoryCacheService.IGetHandler<>), typeof(Get<>));
            services.AddTransient(typeof(IMemoryCacheService.ISetHandler<>), typeof(Set<>));
            services.AddTransient<IMemoryCacheService.IRemoveHandler, Remove>();

            return services;
        }
    }
}
