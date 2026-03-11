// -----------------------------------------------------------------------
// <copyright file="RequestContextLoggingMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using System.Diagnostics;
using D2.Shared.Handler;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

/// <summary>
/// Middleware that pushes non-PII request context fields into the logging
/// scope and OTel trace span tags. Every log entry and span within the
/// request scope automatically includes these fields.
/// </summary>
/// <remarks>
/// <para>
/// Uses <see cref="ILogger.BeginScope{TState}"/> (not Serilog LogContext)
/// so that properties are visible to ALL log providers, including the
/// OTel OTLP log exporter (<c>IncludeScopes = true</c>) and Serilog
/// (whose MEL integration maps BeginScope to LogContext automatically).
/// </para>
/// <para>
/// Must run AFTER authentication middleware so that all identity/org fields
/// are populated.
/// </para>
/// </remarks>
public class RequestContextLoggingMiddleware
{
    private readonly RequestDelegate r_next;
    private readonly ILogger<RequestContextLoggingMiddleware> r_logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RequestContextLoggingMiddleware"/> class.
    /// </summary>
    ///
    /// <param name="next">The next middleware in the pipeline.</param>
    /// <param name="logger">The logger used for creating scoped log contexts.</param>
    public RequestContextLoggingMiddleware(RequestDelegate next, ILogger<RequestContextLoggingMiddleware> logger)
    {
        r_next = next;
        r_logger = logger;
    }

    /// <summary>
    /// Pushes request context fields into the log scope and OTel span.
    /// </summary>
    ///
    /// <param name="context">The HTTP context.</param>
    ///
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var requestContext = context.Features.Get<IRequestContext>();
        if (requestContext is null)
        {
            await r_next(context);
            return;
        }

        // Set OTel span tags for Tempo trace queries (always, including infra).
        // Auth fields (may be null for unauthenticated requests).
        SetSpanTag("userId", requestContext.UserId?.ToString());
        SetSpanTag("username", requestContext.Username);
        SetSpanTag("agentOrgId", requestContext.AgentOrgId?.ToString());
        SetSpanTag("agentOrgType", requestContext.AgentOrgType?.ToString());
        SetSpanTag("agentOrgRole", requestContext.AgentOrgRole);
        SetSpanTag("targetOrgId", requestContext.TargetOrgId?.ToString());
        SetSpanTag("targetOrgType", requestContext.TargetOrgType?.ToString());

        // Network/enrichment fields (present on all requests, even unauthenticated).
        SetSpanTag("deviceFingerprint", requestContext.DeviceFingerprint);
        SetSpanTag("city", requestContext.City);
        SetSpanTag("countryCode", requestContext.CountryCode);
        SetSpanTag("whoIsHashId", requestContext.WhoIsHashId);

        // Auth/trust flags — skip when null (unknown in pre-auth context).
        if (requestContext.IsAuthenticated.HasValue)
        {
            Activity.Current?.SetTag("isAuthenticated", requestContext.IsAuthenticated.Value);
        }

        if (requestContext.IsTrustedService.HasValue)
        {
            Activity.Current?.SetTag("isTrustedService", requestContext.IsTrustedService.Value);
        }

        // Session-dependent flags — only set when confirmed authenticated.
        if (requestContext.IsAuthenticated == true)
        {
            Activity.Current?.SetTag("isOrgEmulating", requestContext.IsOrgEmulating ?? false);
        }

        // Skip log enrichment for infrastructure endpoints to reduce noise.
        if (InfrastructurePaths.IsInfrastructure(context))
        {
            await r_next(context);
            return;
        }

        // Build a dictionary of non-PII fields and push as a MEL scope.
        // ILogger.BeginScope(dict) is visible to both OTel (IncludeScopes)
        // and Serilog (maps to LogContext via SerilogLoggerProvider).
        var scopeState = new Dictionary<string, object?>();
        AddIfNotNull(scopeState, "userId", requestContext.UserId?.ToString());
        AddIfNotNull(scopeState, "username", requestContext.Username);
        AddIfNotNull(scopeState, "agentOrgId", requestContext.AgentOrgId?.ToString());
        AddIfNotNull(scopeState, "agentOrgType", requestContext.AgentOrgType?.ToString());
        AddIfNotNull(scopeState, "agentOrgRole", requestContext.AgentOrgRole);
        AddIfNotNull(scopeState, "targetOrgId", requestContext.TargetOrgId?.ToString());
        AddIfNotNull(scopeState, "targetOrgType", requestContext.TargetOrgType?.ToString());
        if (requestContext.IsAuthenticated.HasValue)
        {
            scopeState["isAuthenticated"] = requestContext.IsAuthenticated.Value;
        }

        if (requestContext.IsTrustedService.HasValue)
        {
            scopeState["isTrustedService"] = requestContext.IsTrustedService.Value;
        }

        if (requestContext.IsAuthenticated == true)
        {
            scopeState["isOrgEmulating"] = requestContext.IsOrgEmulating ?? false;
        }

        AddIfNotNull(scopeState, "deviceFingerprint", requestContext.DeviceFingerprint);
        AddIfNotNull(scopeState, "city", requestContext.City);
        AddIfNotNull(scopeState, "countryCode", requestContext.CountryCode);
        AddIfNotNull(scopeState, "whoIsHashId", requestContext.WhoIsHashId);
        AddIfNotNull(scopeState, "isVpn", requestContext.IsVpn?.ToString());
        AddIfNotNull(scopeState, "isProxy", requestContext.IsProxy?.ToString());
        AddIfNotNull(scopeState, "isTor", requestContext.IsTor?.ToString());
        AddIfNotNull(scopeState, "isHosting", requestContext.IsHosting?.ToString());

        using (r_logger.BeginScope(scopeState))
        {
            await r_next(context);
        }
    }

    /// <summary>
    /// Adds a key-value pair to the scope dictionary if the value is non-null.
    /// </summary>
    private static void AddIfNotNull(Dictionary<string, object?> dict, string key, string? value)
    {
        if (value is not null)
        {
            dict[key] = value;
        }
    }

    /// <summary>
    /// Sets a tag on the current OTel activity/span if the value is non-null.
    /// </summary>
    private static void SetSpanTag(string name, string? value)
    {
        if (value is not null)
        {
            Activity.Current?.SetTag(name, value);
        }
    }
}
