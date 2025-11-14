// -----------------------------------------------------------------------
// <copyright file="DefaultMemoryCacheService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.MemoryCache.Default;

using D2.Contracts.Handler;
using D2.Contracts.Interfaces.CommonCacheService;
using D2.Contracts.Interfaces.MemoryCacheService;
using D2.Contracts.MemoryCache.Default.Handlers;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Interfaces.MemoryCacheService.IMemoryCacheService;

/// <inheritdoc cref="IMemoryCacheService" />
/// <remarks>
/// This is an in-memory caching service.
/// </remarks>
public class DefaultMemoryCacheService : BaseService, IMemoryCacheService
{
    private readonly IMemoryCache r_memoryCache;

    /// <summary>
    /// Initializes a new instance of the <see cref="DefaultMemoryCacheService"/> class.
    /// </summary>
    ///
    /// <param name="memoryCache">
    /// The memory cache instance to use.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public DefaultMemoryCacheService(
        IMemoryCache memoryCache,
        IHandlerContext context)
        : base(context)
    {
        r_memoryCache = memoryCache;
    }

    /// <inheritdoc cref="Handlers.Get{TValue}"/>
    public S.IGetHandler<TValue> Get<TValue>()
        => new Get<TValue>(r_memoryCache, Context);

    /// <inheritdoc cref="Handlers.Set{TValue}"/>
    public S.ISetHandler<TValue> Set<TValue>()
        => new Set<TValue>(r_memoryCache, Context);

    /// <inheritdoc cref="Handlers.Remove"/>
    public S.IRemoveHandler Remove()
        => new Remove(r_memoryCache, Context);
}
