// -----------------------------------------------------------------------
// <copyright file="AcquireLock.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.C;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate.IAcquireLockHandler;
using I = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate.AcquireLockInput;
using O = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate.AcquireLockOutput;

/// <summary>
/// Handler for acquiring a distributed lock in Redis using SET NX with mandatory TTL.
/// </summary>
public class AcquireLock : BaseHandler<H, I, O>, H
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="AcquireLock"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public AcquireLock(
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
            var db = r_redis.GetDatabase();
            var acquired = await db.StringSetAsync(
                input.Key,
                input.LockId,
                input.Expiration,
                When.NotExists);

            return D2Result<O?>.Ok(new O(acquired));
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while acquiring lock for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<O?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE);
        }

        // Let the base handler catch any other exceptions.
    }
}
