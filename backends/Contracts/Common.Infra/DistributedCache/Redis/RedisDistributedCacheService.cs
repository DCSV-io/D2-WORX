using Common.Infra.Common;
using Common.Infra.DistributedCache.Redis.Handlers;
using D2.Contracts.Common.App;
using S = D2.Contracts.Common.App.IDistributedCacheService;

namespace Common.Infra.DistributedCache.Redis;

/// <inheritdoc cref="IDistributedCacheService" />
/// <remarks>
/// This caching service uses Redis.
/// </remarks>
public class RedisDistributedCacheService : BaseService, S
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RedisDistributedCacheService"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public RedisDistributedCacheService(IHandlerContext context) : base(context) { }

    /// <inheritdoc/>
    public S.IGetHandler<TValue> Get<TValue>()
        => new Get<TValue>(Context);

    /// <inheritdoc/>
    public S.ISetHandler<TValue> Set<TValue>()
        => new Set<TValue>(Context);

    /// <inheritdoc/>
    public S.IRemoveHandler Remove()
        => new Remove(Context);

    /// <inheritdoc/>
    public S.IExistsHandler Exists()
        => new Exists(Context);
}
