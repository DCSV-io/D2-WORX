using System.Net;
using D2.Contracts.Common;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using H = D2.Contracts.Common.App.ICommonCacheService.IRemoveHandler;
using I = D2.Contracts.Common.App.ICommonCacheService.RemoveInput;
using O = D2.Contracts.Common.App.ICommonCacheService.RemoveOutput;

namespace Common.Infra.DistributedCache.Redis.Handlers;

/// <inheritdoc cref="H"/>
public class Remove : BaseHandler<H, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Remove"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    ///
    /// <inheritdoc/>
    public Remove(
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
