// -----------------------------------------------------------------------
// <copyright file="Get.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.DistributedCache.Redis.Handlers.R;

// ReSharper disable AccessToStaticMemberViaDerivedType
using System.Net;
using System.Text.Json;
using D2.Shared.Handler;
using D2.Shared.Result;
using D2.Shared.Utilities.Serialization;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using S = D2.Shared.Interfaces.Caching.Distributed.Handlers.R.IRead;

/// <summary>
/// Handler for retrieving a value from the distributed cache.
/// </summary>
///
/// <typeparam name="TValue">
/// The type of the cached value.
/// </typeparam>
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
                return D2Result<S.GetOutput<TValue>?>.NotFound();
            }

            // Deserialize the value.
            var value = typeof(TValue).IsAssignableTo(typeof(Google.Protobuf.IMessage))
                ? ParseProtobuf((byte[])redisValue!)
                : JsonSerializer.Deserialize<TValue>(
                    (byte[])redisValue!,
                    SerializerOptions.SR_IgnoreCycles);

            // Return the result.
            return D2Result<S.GetOutput<TValue>?>.Ok(
                new S.GetOutput<TValue>(value));
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
                errorCode: ErrorCodes.SERVICE_UNAVAILABLE);
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
                ErrorCodes.COULD_NOT_BE_DESERIALIZED);
        }

        // Let the base handler catch any other exceptions.
    }

    /// <summary>
    /// Parses a Protobuf message from a byte array.
    /// </summary>
    ///
    /// <param name="bytes">
    /// The byte array containing the Protobuf message.
    /// </param>
    ///
    /// <returns>
    /// The parsed Protobuf message.
    /// </returns>
    private static TValue ParseProtobuf(byte[] bytes)
    {
        var parserProperty = typeof(TValue).GetProperty(
            "Parser",
            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

        if (parserProperty == null)
        {
            throw new InvalidOperationException(
                $"Type '{typeof(TValue).FullName}' does not have a public static 'Parser' property. Ensure that TValue is a generated protobuf message type.");
        }

        var parser = parserProperty.GetValue(null);
        if (parser == null)
        {
            throw new InvalidOperationException(
                $"The 'Parser' property on type '{typeof(TValue).FullName}' is null. Ensure that TValue is a valid protobuf message type.");
        }

        var parseFromMethod = parser.GetType().GetMethod("ParseFrom", [typeof(byte[])]);
        if (parseFromMethod == null)
        {
            throw new InvalidOperationException(
                $"The 'Parser' object on type '{typeof(TValue).FullName}' does not have a 'ParseFrom(byte[])' method. Ensure that TValue is a valid protobuf message type.");
        }

        return (TValue)parseFromMethod.Invoke(parser, [bytes])!;
    }
}
