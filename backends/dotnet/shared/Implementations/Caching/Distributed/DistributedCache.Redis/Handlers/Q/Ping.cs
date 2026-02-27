// -----------------------------------------------------------------------
// <copyright file="Ping.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.Q;

using System.Diagnostics;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

using H = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.IPingHandler;
using I = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.PingInput;
using O = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead.PingOutput;

/// <summary>
/// Handler for pinging Redis to verify connectivity.
/// </summary>
public class Ping : BaseHandler<H, I, O>, H
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Ping"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Ping(
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
        var sw = Stopwatch.StartNew();
        try
        {
            var db = r_redis.GetDatabase();
            await db.PingAsync();
            sw.Stop();

            return D2Result<O?>.Ok(
                new O(true, sw.ElapsedMilliseconds, null));
        }
        catch (RedisException ex)
        {
            sw.Stop();
            Context.Logger.LogError(
                ex,
                "Redis ping failed. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Ok(
                new O(false, sw.ElapsedMilliseconds, ex.Message));
        }
    }
}
