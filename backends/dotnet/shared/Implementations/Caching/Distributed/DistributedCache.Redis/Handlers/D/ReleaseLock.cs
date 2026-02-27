// -----------------------------------------------------------------------
// <copyright file="ReleaseLock.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.D;

using System.Net;
using D2.Shared.Handler;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.IReleaseLockHandler;
using I = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.ReleaseLockInput;
using O = D2.Shared.Interfaces.Caching.Distributed.Handlers.D.IDelete.ReleaseLockOutput;

/// <summary>
/// Handler for releasing a distributed lock in Redis using an atomic Lua compare-and-delete.
/// </summary>
public class ReleaseLock : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Lua script for atomic compare-and-delete.
    /// Only deletes the key if the stored value matches the provided lock ID.
    /// </summary>
    private const string _RELEASE_LOCK_SCRIPT = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """;

    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="ReleaseLock"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public ReleaseLock(
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
            var result = await db.ScriptEvaluateAsync(
                _RELEASE_LOCK_SCRIPT,
                [(RedisKey)input.Key],
                [(RedisValue)input.LockId]);

            var released = (int)result == 1;
            return D2Result<O?>.Ok(new O(released));
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while releasing lock for key '{Key}'. TraceId: {TraceId}",
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
