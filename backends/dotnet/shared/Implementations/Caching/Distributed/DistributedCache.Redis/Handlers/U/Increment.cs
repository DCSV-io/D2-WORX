// -----------------------------------------------------------------------
// <copyright file="Increment.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.U;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using S = D2.Shared.Interfaces.Caching.Distributed.Handlers.U.IUpdate;

/// <summary>
/// Handler for atomically incrementing a counter in the distributed cache.
/// </summary>
public class Increment : BaseHandler<S.IIncrementHandler, S.IncrementInput, S.IncrementOutput>,
    S.IIncrementHandler
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Increment"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Increment(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<S.IncrementOutput?>> ExecuteAsync(
        S.IncrementInput input,
        CancellationToken ct = default)
    {
        try
        {
            var db = r_redis.GetDatabase();

            // Atomic increment.
            var newValue = await db.StringIncrementAsync(input.Key, input.Amount);

            // Set expiration if provided.
            if (input.Expiration.HasValue)
            {
                await db.KeyExpireAsync(input.Key, input.Expiration.Value);
            }

            return D2Result<S.IncrementOutput?>.Ok(
                new S.IncrementOutput(newValue));
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while incrementing key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<S.IncrementOutput?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE);
        }

        // Let the base handler catch any other exceptions.
    }
}
