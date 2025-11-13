using System.Net;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Contracts.Interfaces.IDistributedCacheService.IExistsHandler;
using I = D2.Contracts.Interfaces.IDistributedCacheService.ExistsInput;
using O = D2.Contracts.Interfaces.IDistributedCacheService.ExistsOutput;

namespace D2.Contracts.DistributedCache.Redis.Handlers;

/// <inheritdoc cref="H"/>
public class Exists : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Exists"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    ///
    /// <inheritdoc/>
    public Exists(
        IConnectionMultiplexer redis,
        // ReSharper disable once InvalidXmlDocComment
        IHandlerContext context) : base(context)
    {
        r_redis = redis;
    }

    private readonly IConnectionMultiplexer r_redis;

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
