// -----------------------------------------------------------------------
// <copyright file="JwtFingerprintMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Gateways.REST.Auth;

using System.Net;
using System.Text.Json;
using D2.Shared.Handler.Auth;
using D2.Shared.Result;

/// <summary>
/// Middleware that validates the JWT <c>fp</c> (fingerprint) claim against the current
/// request's computed fingerprint. Prevents stolen JWT reuse from different clients.
/// </summary>
/// <remarks>
/// <para>Must run AFTER authentication middleware (needs <c>HttpContext.User</c> populated).</para>
/// <para>
/// Behavior:
/// <list type="bullet">
///   <item>No authenticated user → pass through (auth middleware handles this).</item>
///   <item>No <c>fp</c> claim → pass through (backwards-compatible for older JWTs).</item>
///   <item><c>fp</c> claim matches computed fingerprint → pass through.</item>
///   <item><c>fp</c> claim does NOT match → 401 Unauthorized with D2Result error.</item>
/// </list>
/// </para>
/// </remarks>
public class JwtFingerprintMiddleware
{
    private static readonly JsonSerializerOptions sr_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly RequestDelegate r_next;
    private readonly ILogger<JwtFingerprintMiddleware> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="JwtFingerprintMiddleware"/> class.
    /// </summary>
    ///
    /// <param name="next">The next middleware in the pipeline.</param>
    /// <param name="logger">The logger instance.</param>
    public JwtFingerprintMiddleware(RequestDelegate next, ILogger<JwtFingerprintMiddleware> logger)
    {
        r_next = next;
        r_logger = logger;
    }

    /// <summary>
    /// Validates the JWT fingerprint claim against the request headers.
    /// </summary>
    ///
    /// <param name="context">The HTTP context.</param>
    ///
    /// <returns>A task representing the asynchronous operation.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        // Not authenticated → let auth middleware handle it.
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await r_next(context);
            return;
        }

        // Extract the `fp` claim from the JWT.
        var fpClaim = context.User.FindFirst(JwtClaimTypes.FINGERPRINT)?.Value;

        // No `fp` claim → backwards-compatible, pass through.
        if (string.IsNullOrEmpty(fpClaim))
        {
            await r_next(context);
            return;
        }

        // Compute the expected fingerprint from request headers.
        var computed = JwtFingerprintValidator.ComputeFingerprint(context);

        // Compare (case-insensitive hex comparison).
        if (string.Equals(fpClaim, computed, StringComparison.OrdinalIgnoreCase))
        {
            await r_next(context);
            return;
        }

        // Mismatch — JWT is being used from a different client.
        r_logger.LogWarning(
            "JWT fingerprint mismatch for {Path}. Expected: {Expected}, Got: {Got}",
            context.Request.Path,
            Truncate(fpClaim),
            Truncate(computed));

        var response = D2Result.Fail(
            messages: ["JWT fingerprint mismatch. Token cannot be used from this client."],
            statusCode: HttpStatusCode.Unauthorized,
            inputErrors: null,
            errorCode: "JWT_FINGERPRINT_MISMATCH",
            traceId: context.TraceIdentifier);

        context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(response, sr_jsonOptions, context.RequestAborted);
    }

    /// <summary>
    /// Safely truncates a fingerprint hash for logging (avoids IndexOutOfRangeException on short values).
    /// </summary>
    private static string Truncate(string value)
    {
        const int _PREFIX_LENGTH = 8;
        return value.Length > _PREFIX_LENGTH
            ? value[.._PREFIX_LENGTH] + "..."
            : value + "...";
    }
}
