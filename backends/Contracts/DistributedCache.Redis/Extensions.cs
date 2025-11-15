// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable AccessToStaticMemberViaDerivedType
namespace D2.Contracts.DistributedCache.Redis;

using D2.Contracts.DistributedCache.Redis.Handlers;
using D2.Contracts.Interfaces.DistributedCacheService;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

/// <summary>
/// Extension methods for adding Redis distributed caching services.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds Redis distributed caching services to the service collection.
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Adds Redis distributed caching services to the service collection.
        /// </summary>
        ///
        /// <param name="redisConnectionString">
        /// The Redis connection string.
        /// </param>
        ///
        /// <returns>
        /// The updated service collection.
        /// </returns>
        public IServiceCollection AddRedisCaching(string redisConnectionString)
        {
            services.AddSingleton<IConnectionMultiplexer>(_ =>
                ConnectionMultiplexer.Connect(redisConnectionString));

            // The handlers for distributed cache operations.
            services.AddTransient(typeof(IDistributedCacheService.IGetHandler<>), typeof(Get<>));
            services.AddTransient(typeof(IDistributedCacheService.ISetHandler<>), typeof(Set<>));
            services.AddTransient<IDistributedCacheService.IRemoveHandler, Remove>();
            services.AddTransient<IDistributedCacheService.IExistsHandler, Exists>();

            return services;
        }
    }
}
