// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.DistributedCache.Redis;

using D2.Contracts.Interfaces.DistributedCacheService;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

/// <summary>
/// Provides extension methods related to the <see cref="RedisDistributedCacheService"/> and
/// <see cref="IServiceCollection"/>.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds a singleton service for the <see cref="StackExchange.Redis.IConnectionMultiplexer"/>
    /// (<see cref="ConnectionMultiplexer"/>) and a transient service for the
    /// <see cref="IDistributedCacheService"/> (<see cref="RedisDistributedCacheService"/>).
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    /// <param name="redisConnectionString">
    /// The connection string for Redis.
    /// </param>
    ///
    /// <returns>
    /// The service collection with the added services.
    /// </returns>
    public static IServiceCollection AddRedisCaching(
        this IServiceCollection services,
        string redisConnectionString)
    {
        services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddTransient<IDistributedCacheService, RedisDistributedCacheService>();
        return services;
    }
}
