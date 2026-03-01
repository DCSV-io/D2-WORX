// -----------------------------------------------------------------------
// <copyright file="SetNx.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.C;

using System.Net;
using System.Text.Json;
using D2.Shared.Handler;
using D2.Shared.Result;
using D2.Shared.Utilities.Serialization;
using Google.Protobuf;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using C = D2.Shared.Interfaces.Caching.Distributed.Handlers.C.ICreate;

/// <summary>
/// Handler for setting a value in the distributed cache only if the key does not already exist (SET NX).
/// </summary>
///
/// <typeparam name="TValue">
/// The type of the value to cache.
/// </typeparam>
public class SetNx<TValue> : BaseHandler<
        C.ISetNxHandler<TValue>, C.SetNxInput<TValue>, C.SetNxOutput>,
    C.ISetNxHandler<TValue>
{
    private readonly IConnectionMultiplexer r_redis;

    /// <summary>
    /// Initializes a new instance of the <see cref="SetNx{TValue}"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public SetNx(
        IConnectionMultiplexer redis,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
    }

    /// <inheritdoc/>
    protected override async ValueTask<D2Result<C.SetNxOutput?>> ExecuteAsync(
        C.SetNxInput<TValue> input,
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

            // Connect to Redis and set the value only if the key does not exist.
            var db = r_redis.GetDatabase();
            var wasSet = await db.StringSetAsync(
                input.Key,
                bytes,
                input.Expiration is { } ttl ? ttl : Expiration.Default,
                When.NotExists);

            // Return success with whether the key was set.
            return D2Result<C.SetNxOutput?>.Ok(
                new C.SetNxOutput(wasSet));
        }
        catch (RedisException ex)
        {
            Context.Logger.LogError(
                ex,
                "RedisException occurred while setting NX value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            return D2Result<C.SetNxOutput?>.Fail(
                ["Unable to connect to Redis."],
                HttpStatusCode.ServiceUnavailable,
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE);
        }
        catch (JsonException ex)
        {
            Context.Logger.LogError(
                ex,
                "JsonException occurred while serializing value for key '{Key}'. TraceId: {TraceId}",
                input.Key,
                TraceId);

            const string err_msg = "Value could not be serialized.";
            return D2Result<C.SetNxOutput?>.Fail(
                [err_msg],
                HttpStatusCode.InternalServerError,
                [[nameof(C.SetNxInput<TValue>.Value), err_msg]],
                ErrorCodes.COULD_NOT_BE_SERIALIZED);
        }

        // Let the base handler catch any other exceptions.
    }
}
