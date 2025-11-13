using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Caching.Memory;
using H = D2.Contracts.Interfaces.ICommonCacheService.IRemoveHandler;
using I = D2.Contracts.Interfaces.ICommonCacheService.RemoveInput;
using O = D2.Contracts.Interfaces.ICommonCacheService.RemoveOutput;

namespace D2.Contracts.MemoryCache.Default.Handlers;

/// <inheritdoc cref="H"/>
public class Remove : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Remove"/> class.
    /// </summary>
    ///
    /// <inheritdoc/>
    public Remove(
        IMemoryCache memoryCache,
        IHandlerContext context) : base(context)
    {
        r_memoryCache = memoryCache;
    }

    private readonly IMemoryCache r_memoryCache;

    /// <inheritdoc/>
    protected override ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        r_memoryCache.Remove(input.Key);
        return ValueTask.FromResult(D2Result<O?>.Ok(new O(), traceId: TraceId));
    }
}
