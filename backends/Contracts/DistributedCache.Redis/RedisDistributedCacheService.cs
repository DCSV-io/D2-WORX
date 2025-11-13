using D2.Contracts.DistributedCache.Redis.Handlers;
using D2.Contracts.Interfaces;
using D2.Contracts.Handler;
using StackExchange.Redis;
using S = D2.Contracts.Interfaces.IDistributedCacheService;

namespace D2.Contracts.DistributedCache.Redis;

/// <inheritdoc cref="IDistributedCacheService" />
/// <remarks>
/// This distributed caching service uses Redis.
/// </remarks>
public class RedisDistributedCacheService : BaseService, IDistributedCacheService
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RedisDistributedCacheService"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    ///
    /// <inheritdoc/>
    public RedisDistributedCacheService(
        IConnectionMultiplexer redis,
        // ReSharper disable once InvalidXmlDocComment
        IHandlerContext context) : base(context)
    {
        r_redis = redis;
    }

    private readonly IConnectionMultiplexer r_redis;

    /// <inheritdoc/>
    public S.IGetHandler<TValue> Get<TValue>()
        => new Get<TValue>(r_redis, Context);

    /// <inheritdoc/>
    public S.ISetHandler<TValue> Set<TValue>()
        => new Set<TValue>(r_redis, Context);

    /// <inheritdoc/>
    public S.IRemoveHandler Remove()
        => new Remove(r_redis, Context);

    /// <inheritdoc/>
    public S.IExistsHandler Exists()
        => new Exists(r_redis, Context);
}
