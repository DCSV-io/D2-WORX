// -----------------------------------------------------------------------
// <copyright file="RateLimitMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Default;

using System.Net;
using System.Text.Json;
using D2.Shared.RateLimit.Default.Interfaces;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.Result;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

/// <summary>
/// Middleware that enforces multi-dimensional rate limiting.
/// </summary>
/// <remarks>
/// Reads <see cref="IRequestInfo"/> from HttpContext.Features and calls the rate
/// limit check handler. Returns 429 Too Many Requests if blocked.
/// </remarks>
public class RateLimitMiddleware
{
    private readonly RequestDelegate r_next;
    private readonly ILogger<RateLimitMiddleware> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RateLimitMiddleware"/> class.
    /// </summary>
    ///
    /// <param name="next">
    /// The next middleware in the pipeline.
    /// </param>
    /// <param name="logger">
    /// The logger instance.
    /// </param>
    public RateLimitMiddleware(
        RequestDelegate next,
        ILogger<RateLimitMiddleware> logger)
    {
        r_next = next;
        r_logger = logger;
    }

    /// <summary>
    /// Invokes the middleware.
    /// </summary>
    ///
    /// <param name="context">
    /// The HTTP context.
    /// </param>
    /// <param name="checkHandler">
    /// The rate limit check handler (injected per-request).
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    public async Task InvokeAsync(
        HttpContext context,
        IRateLimit.ICheckHandler checkHandler)
    {
        // Get request info from previous middleware.
        var requestInfo = context.Features.Get<IRequestInfo>();
        if (requestInfo is null)
        {
            r_logger.LogWarning(
                "IRequestInfo not found in HttpContext.Features. Ensure RequestEnrichmentMiddleware runs first. Allowing request.");

            await r_next(context);
            return;
        }

        // Check rate limits.
        IRateLimit.CheckOutput? output = null;
        try
        {
            var checkResult = await checkHandler.HandleAsync(
                new IRateLimit.CheckInput(requestInfo),
                context.RequestAborted);

            if (checkResult.CheckSuccess(out var checkOutput))
            {
                output = checkOutput;
            }
        }
        catch (Exception ex)
        {
            // Fail-open: log warning and allow request through.
            r_logger.LogWarning(
                ex,
                "Rate limit check failed for IP {ClientIp}. Allowing request through (fail-open).",
                requestInfo.ClientIp);
        }

        if (output?.IsBlocked == true)
        {
            // Request is blocked — return 429.
            var retryAfterSeconds = output.RetryAfter?.TotalSeconds ?? 300;

            context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
            context.Response.Headers.RetryAfter = ((int)retryAfterSeconds).ToString();
            context.Response.ContentType = "application/json";

            var response = D2Result.Fail(
                [$"Rate limit exceeded on {output.BlockedDimension} dimension."],
                HttpStatusCode.TooManyRequests,
                inputErrors: null,
                ErrorCodes.RATE_LIMITED,
                context.TraceIdentifier);

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            };

            await context.Response.WriteAsJsonAsync(response, jsonOptions, context.RequestAborted);

            r_logger.LogInformation(
                "Rate limited request from IP {ClientIp} on {Dimension} dimension. RetryAfter: {RetryAfter}s",
                requestInfo.ClientIp,
                output.BlockedDimension,
                retryAfterSeconds);

            return;
        }

        // Not blocked — continue pipeline.
        await r_next(context);
    }
}
