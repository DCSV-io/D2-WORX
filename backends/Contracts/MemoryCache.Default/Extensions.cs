using D2.Contracts.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace D2.Contracts.MemoryCache.Default;

/// <summary>
/// Provides extension methods related to the <see cref="DefaultMemoryCacheService"/> and
/// <see cref="IServiceCollection"/>.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds a singleton service for the <see cref="DefaultMemoryCacheService"/> and a transient service for the
    /// <see cref="services"/> (<see cref="IMemoryCache"/>).
    /// </summary>
    /// <param name="services"></param>
    /// <returns></returns>
    public static IServiceCollection AddDefaultMemoryCaching(
        this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.AddTransient<IMemoryCacheService, DefaultMemoryCacheService>();
        return services;
    }
}
