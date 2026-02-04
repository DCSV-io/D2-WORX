// -----------------------------------------------------------------------
// <copyright file="Set.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.DistributedCache.Redis.Handlers.U;

using System.Net;
using System.Text.Json;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Contracts.Utilities.Serialization;
using Google.Protobuf;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using S = D2.Contracts.Interfaces.Caching.Distributed.Handlers.U.IUpdate;

/// <summary>
/// Handler for setting a value in the distributed cache.
/// </summary>
///
/// <typeparam name="TValue">
/// The type of the value to cache.
/// </typeparam>
public class Set<TValue> : BaseHandler<
        S.ISetHandler<TValue>, S.SetInput<TValue>, S.SetOutput>,
    S.ISetHandler<TValue>
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Set{TValue}"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Set(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<S.SetOutput?>> ExecuteAsync(
        S.SetInput<TValue> input,
        CancellationToken ct = default)
    {
        try
        {
            // Serialize the value.
            var bytes = input.Value is IMessage message
                ? message.ToByteArray()
                : JsonSerializer.SerializeToUtf8Bytes(
                    input.Value,
                    SerializerOptions.SR_IgnoreCycles);

            // Connect to Redis and set the value.
            var db = r_redis.GetDatabase();
            await db.StringSetAsync(input.Key, bytes, input.Expiration);

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
