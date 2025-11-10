using Common.Infra.Cache.Redis.Handlers;
using Common.Infra.Common;
using D2.Contracts.Common.App;
using S = D2.Contracts.Common.App.ICacheService;

namespace Common.Infra.Cache.Redis;

/// <inheritdoc cref="S" />
/// <remarks>
/// This caching service uses Redis.
/// </remarks>
public class RedisCacheService : BaseService, S
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RedisCacheService"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public RedisCacheService(IHandlerContext context) : base(context) { }

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
