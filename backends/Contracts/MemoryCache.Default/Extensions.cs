// -----------------------------------------------------------------------
// <copyright file="Extensions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.MemoryCache.Default;

using D2.Contracts.Interfaces.MemoryCacheService;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// Provides extension methods related to the <see cref="DefaultMemoryCacheService"/> and
/// <see cref="IServiceCollection"/>.
/// </summary>
public static class Extensions
{
    /// <summary>
    /// Adds a singleton service for the <see cref="DefaultMemoryCacheService"/> and a transient
    /// service for the <paramref name="services"/>/> (<see cref="IMemoryCache"/>).
    /// </summary>
    ///
    /// <param name="services">
    /// The service collection to add the services to.
    /// </param>
    ///
    /// <returns>
    /// The service collection with the added services.
    /// </returns>
    public static IServiceCollection AddDefaultMemoryCaching(
        this IServiceCollection services)
    {
        services.AddMemoryCache();
        services.AddTransient<IMemoryCacheService, DefaultMemoryCacheService>();
        return services;
    }
}
