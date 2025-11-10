using Common.Infra.Common;
using Common.Infra.DistributedCache.Redis.Handlers;
using D2.Contracts.Common.App;
using StackExchange.Redis;
using S = D2.Contracts.Common.App.IDistributedCacheService;

namespace Common.Infra.DistributedCache.Redis;

/// <inheritdoc cref="IDistributedCacheService" />
/// <remarks>
/// This distributed caching service uses Redis.
/// </remarks>
public class RedisDistributedCacheService : BaseService, S
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
