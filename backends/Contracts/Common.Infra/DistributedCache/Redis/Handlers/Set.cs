using System.Net;
using System.Text.Json;
using D2.Contracts.Common;
using D2.Contracts.Common.App;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using S = D2.Contracts.Common.App.ICommonCacheService;

namespace Common.Infra.DistributedCache.Redis.Handlers;

/// <inheritdoc cref="S.ISetHandler{TValue}"/>
public class Set<TValue> : BaseHandler<
        S.ISetHandler<TValue>, S.SetInput<TValue>, S.SetOutput>,
    S.ISetHandler<TValue>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Set{TValue}"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    ///
    /// <inheritdoc/>
    public Set(
        IConnectionMultiplexer redis,
        // ReSharper disable once InvalidXmlDocComment
        IHandlerContext context) : base(context)
    {
        r_redis = redis;
    }

    private readonly IConnectionMultiplexer r_redis;

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<S.SetOutput?>> ExecuteAsync(
        S.SetInput<TValue> input,
        CancellationToken ct = default)
    {
        try
        {
            // Serialize the value.
            var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(
                input.Value,
                SerializerOptions.SR_IgnoreCycles);

            // Connect to Redis and set the value.
            var db = r_redis.GetDatabase();
            await db.StringSetAsync(input.Key, jsonBytes, input.Expiration);

            // Return success.
            return D2Result<S.SetOutput?>.Ok(
                new S.SetOutput(),
                traceId: TraceId);
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while setting value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<S.SetOutput?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                traceId: TraceId);
        }
        catch (JsonException ex)
        {
            Context.Logger.LogError(
                ex,
                "JsonException occurred while serializing value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            const string err_msg = "Value could not be serialized.";
            return D2Result<S.SetOutput?>.Fail(
                [err_msg],
                HttpStatusCode.InternalServerError,
                [[nameof(S.SetInput<TValue>.Value), err_msg]],
                ErrorCodes.COULD_NOT_BE_SERIALIZED,
                TraceId);
        }

        // Let the base handler catch any other exceptions.
    }
}
