// -----------------------------------------------------------------------
// <copyright file="Remove.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.D;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.IRemoveHandler;
using I = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.RemoveInput;
using O = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.RemoveOutput;

/// <summary>
/// Handler for removing a value from the Redis distributed cache.
/// </summary>
public class Remove : BaseHandler<H, I, O>, H
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Remove"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Remove(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        try
        {
            // Connect to Redis and remove the key.
            var db = r_redis.GetDatabase();
            await db.KeyDeleteAsync(input.Key);

            // Return success.
            return D2Result<O?>.Ok(
                new O(),
                traceId: TraceId);
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while removing key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<O?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                traceId: TraceId);
        }

        // Let the base handler catch any other exceptions.
    }
}
