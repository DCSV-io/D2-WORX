// -----------------------------------------------------------------------
// <copyright file="Exists.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.R;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.IExistsHandler;
using I = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.ExistsInput;
using O = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.ExistsOutput;

/// <summary>
/// Handler for checking if a key exists in the Redis distributed cache.
/// </summary>
public class Exists : BaseHandler<H, I, O>, H
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Exists"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Exists(
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
            // Connect to Redis and check if the key exists.
            var db = r_redis.GetDatabase();
            var exists = await db.KeyExistsAsync(input.Key);

            // Return the result.
            return D2Result<O?>.Ok(
                new O(exists),
                traceId: TraceId);
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while checking existence of key '{Key}'. TraceId: {TraceId}",
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
