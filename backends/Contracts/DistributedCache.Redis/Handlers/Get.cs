// -----------------------------------------------------------------------
// <copyright file="Get.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.DistributedCache.Redis.Handlers;

using System.Net;
using System.Text.Json;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Contracts.Utilities.Serialization;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using S = D2.Contracts.Interfaces.CommonCacheService.ICommonCacheService;

/// <inheritdoc cref="S.IGetHandler{TValue}"/>
public class Get<TValue> : BaseHandler<
        S.IGetHandler<TValue>, S.GetInput, S.GetOutput<TValue>>,
    S.IGetHandler<TValue>
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="Get{TValue}"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Get(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<S.GetOutput<TValue>?>> ExecuteAsync(
        S.GetInput input,
        CancellationToken ct = default)
    {
        try
        {
            // Connect to Redis and get the value.
            var db = r_redis.GetDatabase();
            var redisValue = await db.StringGetAsync(input.Key);

            // If no value was retrieved, return NotFound.
            if (!redisValue.HasValue)
            {
                return D2Result<S.GetOutput<TValue>?>.NotFound(traceId: TraceId);
            }

            // Deserialize the value.
            var value = JsonSerializer.Deserialize<TValue>(
                (byte[])redisValue!,
                SerializerOptions.SR_IgnoreCycles);

            // Return the result.
            return D2Result<S.GetOutput<TValue>?>.Ok(
                new S.GetOutput<TValue>(value),
                traceId: TraceId);
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while getting value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<S.GetOutput<TValue>?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
                traceId: TraceId);
        }
        catch (JsonException ex)
        {
            Context.Logger.LogError(
                ex,
                "JsonException occurred while deserializing value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            const string err_msg = "Value could not be deserialized.";
            return D2Result<S.GetOutput<TValue>?>.Fail(
                [err_msg],
                HttpStatusCode.InternalServerError,
                [[nameof(S.GetInput.Key), err_msg]],
                ErrorCodes.COULD_NOT_BE_DESERIALIZED,
                TraceId);
        }

        // Let the base handler catch any other exceptions.
    }
}
