using D2.Contracts.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace D2.Contracts.DistributedCache.Redis;

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
    /// The service collection.
    /// </param>
    /// <param name="redisConnectionString">
    /// The connection string for Redis.
    /// </param>
    ///
    /// <returns>
    /// The service collection.
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
