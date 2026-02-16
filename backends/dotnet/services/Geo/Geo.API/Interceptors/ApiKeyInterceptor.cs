// -----------------------------------------------------------------------
// <copyright file="ApiKeyInterceptor.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.API.Interceptors;

using D2.Geo.App;
using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

/// <summary>
/// gRPC server interceptor that validates API keys from incoming requests.
/// Reads the <c>x-api-key</c> metadata header and validates it against
/// <see cref="GeoAppOptions.ApiKeyMappings"/>.
///
/// Behavior is driven by <see cref="RequiresApiKeyAttribute"/> on service methods:
/// <list type="bullet">
///   <item>No attribute → pass through (no API key check).</item>
///   <item><c>[RequiresApiKey]</c> → validate API key only.</item>
///   <item><c>[RequiresApiKey(ValidateContextKeys = true)]</c> → validate API key
///         AND verify request context keys are in the caller's allowed set.</item>
/// </list>
/// </summary>
public class ApiKeyInterceptor : Interceptor
{
    private readonly GeoAppOptions r_options;
    private readonly ILogger<ApiKeyInterceptor> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ApiKeyInterceptor"/> class.
    /// </summary>
    /// <param name="options">The Geo app options containing API key mappings.</param>
    /// <param name="logger">The logger.</param>
    public ApiKeyInterceptor(
        IOptions<GeoAppOptions> options,
        ILogger<ApiKeyInterceptor> logger)
    {
        r_options = options.Value;
        r_logger = logger;
    }

    /// <inheritdoc/>
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        // Read the RequiresApiKey attribute from endpoint metadata.
        var httpContext = context.GetHttpContext();
        var endpoint = httpContext.GetEndpoint();
        var attr = endpoint?.Metadata.GetMetadata<RequiresApiKeyAttribute>();

        // No attribute → pass through without API key checks.
        if (attr is null)
        {
            return await continuation(request, context);
        }

        var methodName = GetMethodName(context.Method);

        // Fail closed: if API key mappings are not configured, reject protected RPCs.
        if (r_options.ApiKeyMappings.Count == 0)
        {
            r_logger.LogError(
                "API key mappings are not configured but RPC {Method} requires an API key",
                methodName);
            throw new RpcException(
                new Status(
                    StatusCode.Unauthenticated,
                    "API key authentication is not configured."));
        }

        // Extract API key from metadata.
        var apiKey = context.RequestHeaders.GetValue("x-api-key");
        if (string.IsNullOrEmpty(apiKey))
        {
            r_logger.LogWarning(
                "Missing x-api-key header on RPC {Method}", methodName);
            throw new RpcException(
                new Status(StatusCode.Unauthenticated, "Missing x-api-key header."));
        }

        // Validate API key exists in mappings.
        if (!r_options.ApiKeyMappings.TryGetValue(apiKey, out var allowedContextKeys))
        {
            r_logger.LogWarning(
                "Invalid API key on RPC {Method}", methodName);
            throw new RpcException(
                new Status(StatusCode.Unauthenticated, "Invalid API key."));
        }

        // If the attribute does not require context key validation, we're done.
        if (!attr.ValidateContextKeys)
        {
            return await continuation(request, context);
        }

        // Extract and validate context keys from the request.
        var requestContextKeys = ExtractContextKeys(request);
        foreach (var contextKey in requestContextKeys)
        {
            if (!allowedContextKeys.Contains(contextKey))
            {
                r_logger.LogWarning(
                    "API key not authorized for context key \"{ContextKey}\" on {Method}",
                    contextKey,
                    methodName);
                throw new RpcException(
                    new Status(
                        StatusCode.PermissionDenied,
                        $"Not authorized for context key \"{contextKey}\"."));
            }
        }

        return await continuation(request, context);
    }

    /// <summary>
    /// Extracts the short method name from the full gRPC method path.
    /// </summary>
    private static string GetMethodName(string fullMethod)
    {
        // fullMethod is like "/d2.geo.v1.GeoService/CreateContacts"
        var lastSlash = fullMethod.LastIndexOf('/');
        return lastSlash >= 0 ? fullMethod[(lastSlash + 1)..] : fullMethod;
    }

    /// <summary>
    /// Extracts context keys from the request message by pattern-matching
    /// on the known proto request types.
    /// </summary>
    private static HashSet<string> ExtractContextKeys<TRequest>(TRequest request)
        where TRequest : class
    {
        var keys = new HashSet<string>();

        if (request is D2.Services.Protos.Geo.V1.CreateContactsRequest createReq)
        {
            foreach (var contact in createReq.ContactsToCreate)
            {
                keys.Add(contact.ContextKey);
            }
        }
        else if (request is D2.Services.Protos.Geo.V1.GetContactsByExtKeysRequest getExtReq)
        {
            foreach (var key in getExtReq.Keys)
            {
                keys.Add(key.ContextKey);
            }
        }
        else if (request is D2.Services.Protos.Geo.V1.DeleteContactsByExtKeysRequest deleteExtReq)
        {
            foreach (var key in deleteExtReq.Keys)
            {
                keys.Add(key.ContextKey);
            }
        }
        else if (request is D2.Services.Protos.Geo.V1.UpdateContactsByExtKeysRequest updateExtReq)
        {
            foreach (var contact in updateExtReq.Contacts)
            {
                keys.Add(contact.ContextKey);
            }
        }

        return keys;
    }
}
