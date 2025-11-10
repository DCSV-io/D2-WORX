using Common.Infra.Common;
using Common.Infra.MemoryCache.Default.Handlers;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Common.App.IMemoryCacheService;

namespace Common.Infra.MemoryCache.Default;

/// <inheritdoc cref="IMemoryCacheService" />
/// <remarks>
/// This is an in-memory caching service.
/// </remarks>
public class DefaultMemoryCacheService : BaseService, S
{
    /// <summary>
    /// Initializes a new instance of the <see cref="DefaultMemoryCacheService"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public DefaultMemoryCacheService(
        IMemoryCache memoryCache,
        IHandlerContext context) : base(context)
    {
        r_memoryCache = memoryCache;
    }

    private readonly IMemoryCache r_memoryCache;

    /// <inheritdoc/>
    public S.IGetHandler<TValue> Get<TValue>()
        => new Get<TValue>(r_memoryCache, Context);

    /// <inheritdoc/>
    public S.ISetHandler<TValue> Set<TValue>()
        => new Set<TValue>(r_memoryCache, Context);

    /// <inheritdoc/>
    public S.IRemoveHandler Remove()
        => new Remove(r_memoryCache, Context);
}
