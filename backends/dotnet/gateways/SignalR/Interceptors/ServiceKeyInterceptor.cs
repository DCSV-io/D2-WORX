// -----------------------------------------------------------------------
// <copyright file="ServiceKeyInterceptor.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.SignalR.Interceptors;

using System.Security.Cryptography;
using System.Text;
using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.Extensions.Options;

/// <summary>
/// gRPC server interceptor that validates API keys from incoming requests.
/// Reads the <c>x-api-key</c> metadata header and validates it against
/// a configured set of valid keys using constant-time comparison.
/// </summary>
public partial class ServiceKeyInterceptor : Interceptor
{
    private readonly SignalRServiceKeyOptions r_options;
    private readonly ILogger<ServiceKeyInterceptor> r_logger;
    private readonly byte[][] r_validKeyBytes;

    /// <summary>
    /// Initializes a new instance of the <see cref="ServiceKeyInterceptor"/> class.
    /// </summary>
    /// <param name="options">The service key options.</param>
    /// <param name="logger">The logger.</param>
    public ServiceKeyInterceptor(
        IOptions<SignalRServiceKeyOptions> options,
        ILogger<ServiceKeyInterceptor> logger)
    {
        r_options = options.Value;
        r_logger = logger;
        r_validKeyBytes = r_options.ValidKeys.Select(k => Encoding.UTF8.GetBytes(k)).ToArray();
    }

    /// <inheritdoc/>
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        var httpContext = context.GetHttpContext();
        var endpoint = httpContext.GetEndpoint();
        var attr = endpoint?.Metadata.GetMetadata<RequiresServiceKeyAttribute>();

        // No attribute → pass through (e.g., CheckHealth).
        if (attr is null)
        {
            return await continuation(request, context);
        }

        var apiKey = context.RequestHeaders.GetValue("x-api-key");
        if (string.IsNullOrEmpty(apiKey))
        {
            LogMissingApiKey(r_logger, context.Method);
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Missing x-api-key header."));
        }

        if (!ConstantTimeContains(r_validKeyBytes, apiKey))
        {
            LogInvalidApiKey(r_logger, context.Method);
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Invalid API key."));
        }

        return await continuation(request, context);
    }

    /// <summary>
    /// Constant-time check for whether a key exists in the valid keys list.
    /// Prevents timing attacks on API key validation.
    /// Key bytes are pre-computed in the constructor to avoid per-request encoding.
    /// </summary>
    private static bool ConstantTimeContains(byte[][] validKeyBytes, string candidate)
    {
        var candidateBytes = Encoding.UTF8.GetBytes(candidate);
        var found = false;

        foreach (var keyBytes in validKeyBytes)
        {
            if (keyBytes.Length == candidateBytes.Length &&
                CryptographicOperations.FixedTimeEquals(keyBytes, candidateBytes))
            {
                found = true;
            }
        }

        return found;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Missing x-api-key header on gRPC call {Method}")]
    private static partial void LogMissingApiKey(ILogger logger, string method);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Invalid API key on gRPC call {Method}")]
    private static partial void LogInvalidApiKey(ILogger logger, string method);
}
