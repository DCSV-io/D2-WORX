// -----------------------------------------------------------------------
// <copyright file="RedisDistributedCacheService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.DistributedCache.Redis;

using D2.Contracts.DistributedCache.Redis.Handlers;
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.DistributedCacheService;
using StackExchange.Redis;
using S = D2.Contracts.Interfaces.DistributedCacheService.IDistributedCacheService;

/// <inheritdoc cref="IDistributedCacheService" />
/// <remarks>
/// This distributed caching service uses Redis.
/// </remarks>
public class RedisDistributedCacheService : BaseService, IDistributedCacheService
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="RedisDistributedCacheService"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public RedisDistributedCacheService(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc cref="Handlers.Get{TValue}"/>
    public S.IGetHandler<TValue> Get<TValue>()
        => new Get<TValue>(r_redis, Context);

    /// <inheritdoc cref="Handlers.Set{TValue}"/>
    public S.ISetHandler<TValue> Set<TValue>()
        => new Set<TValue>(r_redis, Context);

    /// <inheritdoc cref="Handlers.Remove"/>
    public S.IRemoveHandler Remove()
        => new Remove(r_redis, Context);

    /// <inheritdoc cref="Handlers.Exists"/>
    public S.IExistsHandler Exists()
        => new Exists(r_redis, Context);
}
