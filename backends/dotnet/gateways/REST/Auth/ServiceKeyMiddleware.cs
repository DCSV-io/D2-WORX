// -----------------------------------------------------------------------
// <copyright file="ServiceKeyMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Auth;

using System.Net;
using System.Security.Cryptography;
using System.Text;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.Result;
using Microsoft.Extensions.Options;

/// <summary>
/// Middleware that identifies trusted service-to-service requests by validating
/// the <c>X-Api-Key</c> header. Runs before rate limiting so trusted services
/// bypass rate limits and fingerprint checks.
/// </summary>
/// <remarks>
/// <para>Must run AFTER <see cref="RequestEnrichmentMiddleware"/> (needs <see cref="IRequestInfo"/> on features).</para>
/// <para>Must run BEFORE rate limiting middleware.</para>
/// <para>
/// Behavior:
/// <list type="bullet">
///   <item>No <c>X-Api-Key</c> header → pass through (browser request).</item>
///   <item>Valid key → set <see cref="IRequestInfo.IsTrustedService"/> to true, continue.</item>
///   <item>Invalid key → 401 immediately (fail fast, before rate limiting).</item>
/// </list>
/// </para>
/// </remarks>
public class ServiceKeyMiddleware
{
    private readonly RequestDelegate r_next;
    private readonly ILogger<ServiceKeyMiddleware> r_logger;
    private readonly byte[][] r_validKeyBytes;

    /// <summary>
    /// Initializes a new instance of the <see cref="ServiceKeyMiddleware"/> class.
    /// </summary>
    ///
    /// <param name="next">The next middleware in the pipeline.</param>
    /// <param name="options">The service key configuration options.</param>
    /// <param name="logger">The logger instance.</param>
    public ServiceKeyMiddleware(
        RequestDelegate next,
        IOptions<ServiceKeyOptions> options,
        ILogger<ServiceKeyMiddleware> logger)
    {
        r_next = next;
        r_logger = logger;
        r_validKeyBytes = options.Value.ValidKeys
            .Select(k => Encoding.UTF8.GetBytes(k))
            .ToArray();
    }

    /// <summary>
    /// Validates the <c>X-Api-Key</c> header and sets the trust flag on <see cref="IRequestInfo"/>.
    /// </summary>
    ///
    /// <param name="context">The HTTP context.</param>
    ///
    /// <returns>A task representing the asynchronous operation.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var apiKey = context.Request.Headers["X-Api-Key"].FirstOrDefault();

        // No key → browser request, continue normally.
        if (string.IsNullOrEmpty(apiKey))
        {
            await r_next(context);
            return;
        }

        // Timing-safe key validation: compare against ALL keys using
        // FixedTimeEquals to prevent timing side-channel attacks.
        var apiKeyBytes = Encoding.UTF8.GetBytes(apiKey);
        var matched = false;
        foreach (var validKeyBytes in r_validKeyBytes)
        {
            if (CryptographicOperations.FixedTimeEquals(apiKeyBytes, validKeyBytes))
            {
                matched = true;
            }

            // Continue loop — always compare ALL keys to prevent timing leaks.
        }

        // Invalid key → 401 immediately (fail fast).
        if (!matched)
        {
            r_logger.LogWarning("Invalid service API key presented");

            context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(
                D2Result.Fail(
                    ["Invalid service API key."],
                    HttpStatusCode.Unauthorized,
                    inputErrors: null,
                    errorCode: "INVALID_SERVICE_KEY",
                    traceId: context.TraceIdentifier),
                context.RequestAborted);
            return;
        }

        // Valid key → mark as trusted.
        var requestInfo = context.Features.Get<IRequestInfo>();
        if (requestInfo is not null)
        {
            requestInfo.IsTrustedService = true;
        }

        r_logger.LogDebug("Request authenticated via service key");
        await r_next(context);
    }
}
