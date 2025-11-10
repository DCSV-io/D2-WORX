using D2.Contracts.Common;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Caching.Memory;
using H = D2.Contracts.Common.App.ICommonCacheService.IRemoveHandler;
using I = D2.Contracts.Common.App.ICommonCacheService.RemoveInput;
using O = D2.Contracts.Common.App.ICommonCacheService.RemoveOutput;

namespace Common.Infra.MemoryCache.Default.Handlers;

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
