using D2.Contracts.Common;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Common.App.ICommonCacheService;

namespace Common.Infra.MemoryCache.Default.Handlers;

/// <inheritdoc cref="S.IGetHandler{TValue}"/>
public class Get<TValue> : BaseHandler<
        S.IGetHandler<TValue>, S.GetInput, S.GetOutput<TValue>>,
    S.IGetHandler<TValue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Get{TValue}"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Get(
        IMemoryCache memoryCache,
        IHandlerContext context) : base(context)
    {
        r_memoryCache = memoryCache;
    }

    private readonly IMemoryCache r_memoryCache;

    /// <inheritdoc/>
    protected override ValueTask<D2Result<S.GetOutput<TValue>?>> ExecuteAsync(
        S.GetInput input,
        CancellationToken ct = default)
    {
        if (r_memoryCache.TryGetValue<TValue>(input.Key, out var value))
            return ValueTask.FromResult(
                D2Result<S.GetOutput<TValue>?>.Ok(
                    new S.GetOutput<TValue>(value),
                    traceId: TraceId));

        return ValueTask.FromResult(
            D2Result<S.GetOutput<TValue>?>.NotFound(traceId: TraceId));
    }
}
