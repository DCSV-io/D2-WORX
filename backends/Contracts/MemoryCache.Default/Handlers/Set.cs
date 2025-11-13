using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Interfaces.ICommonCacheService;

namespace D2.Contracts.MemoryCache.Default.Handlers;

/// <inheritdoc cref="S.ISetHandler{TValue}"/>
public class Set<TValue> : BaseHandler<
        S.ISetHandler<TValue>, S.SetInput<TValue>, S.SetOutput>,
    S.ISetHandler<TValue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Set{TValue}"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Set(
        IMemoryCache memoryCache,
        IHandlerContext context) : base(context)
    {
        r_memoryCache = memoryCache;
    }

    private readonly IMemoryCache r_memoryCache;

    /// <inheritdoc/>
    protected override ValueTask<D2Result<S.SetOutput?>> ExecuteAsync(
        S.SetInput<TValue> input,
        CancellationToken ct = default)
    {
        if (input.Expiration.HasValue)
            r_memoryCache.Set(input.Key, input.Value, input.Expiration.Value);
        else
            r_memoryCache.Set(input.Key, input.Value);

        return ValueTask.FromResult(D2Result<S.SetOutput?>.Ok(new S.SetOutput(), traceId: TraceId));
    }
}
