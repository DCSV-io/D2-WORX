// -----------------------------------------------------------------------
// <copyright file="Get.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.MemoryCache.Default.Handlers;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Caching.Memory;
using S = D2.Contracts.Interfaces.CommonCacheService.ICommonCacheService;

/// <inheritdoc cref="S.IGetHandler{TValue}"/>
public class Get<TValue> : BaseHandler<
        S.IGetHandler<TValue>, S.GetInput, S.GetOutput<TValue>>,
    S.IGetHandler<TValue>
{
    private readonly IMemoryCache r_memoryCache;

    /// <summary>
    /// Initializes a new instance of the <see cref="Get{TValue}"/> class.
    /// </summary>
    ///
    /// <param name="memoryCache">
    /// The memory cache instance to use.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Get(
        IMemoryCache memoryCache,
        IHandlerContext context)
        : base(context)
    {
        r_memoryCache = memoryCache;
    }

    /// <inheritdoc/>
    protected override ValueTask<D2Result<S.GetOutput<TValue>?>> ExecuteAsync(
        S.GetInput input,
        CancellationToken ct = default)
    {
        if (r_memoryCache.TryGetValue<TValue>(input.Key, out var value))
        {
            return ValueTask.FromResult(
                D2Result<S.GetOutput<TValue>?>.Ok(
                    new S.GetOutput<TValue>(value),
                    traceId: TraceId));
        }

        return ValueTask.FromResult(
            D2Result<S.GetOutput<TValue>?>.NotFound(traceId: TraceId));
    }
}
