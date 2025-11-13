using D2.Contracts.Interfaces;
using D2.Contracts.Handler;
using D2.Contracts.MemoryCache.Default.Handlers;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Interfaces.IMemoryCacheService;

namespace D2.Contracts.MemoryCache.Default;

/// <inheritdoc cref="IMemoryCacheService" />
/// <remarks>
/// This is an in-memory caching service.
/// </remarks>
public class DefaultMemoryCacheService : BaseService, IMemoryCacheService
{
    /// <summary>
    /// Initializes a new instance of the <see cref="DefaultMemoryCacheService"/> class.
    /// </summary>
    ///
    /// <param name="memoryCache">
    /// The memory cache instance to use.
    /// </param>
    ///
    /// <inheritdoc/>
    public DefaultMemoryCacheService(
        IMemoryCache memoryCache,
        // ReSharper disable once InvalidXmlDocComment
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
