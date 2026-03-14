// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using System.Diagnostics;
using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using D2.Shared.Handler;
using D2.Shared.Utilities.Extensions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Middleware that enriches HTTP requests with client information.
/// </summary>
/// <remarks>
/// Resolves client IP, computes fingerprints, and optionally performs WhoIs lookups.
/// The enriched information is stored in <see cref="HttpContext.Features"/> as
/// <see cref="IRequestContext"/>.
/// </remarks>
public partial class RequestEnrichmentMiddleware
{
    private readonly RequestDelegate r_next;
    private readonly ILogger<RequestEnrichmentMiddleware> r_logger;
    private readonly RequestEnrichmentOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="RequestEnrichmentMiddleware"/> class.
    /// </summary>
    ///
    /// <param name="next">
    /// The next middleware in the pipeline.
    /// </param>
    /// <param name="options">
    /// The middleware options.
    /// </param>
    /// <param name="logger">
    /// The logger instance.
    /// </param>
    public RequestEnrichmentMiddleware(
        RequestDelegate next,
        IOptions<RequestEnrichmentOptions> options,
        ILogger<RequestEnrichmentMiddleware> logger)
    {
        r_next = next;
        r_options = options.Value;
        r_logger = logger;
    }

    /// <summary>
    /// Invokes the middleware.
    /// </summary>
    ///
    /// <param name="context">
    /// The HTTP context.
    /// </param>
    /// <param name="whoIsHandler">
    /// The WhoIs lookup handler (injected per-request).
    /// </param>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    public async Task InvokeAsync(
        HttpContext context,
        IComplex.IFindWhoIsHandler whoIsHandler)
    {
        // Skip enrichment entirely for infrastructure endpoints (health checks, metrics).
        if (InfrastructurePaths.IsInfrastructure(context))
        {
            await r_next(context);
            return;
        }

        // 1. Resolve client IP (only trusting configured proxy headers).
        var clientIp = IpResolver.Resolve(context, r_options.TrustedProxyHeaders, r_options.MaxForwardedForLength);

        // 2. Compute server fingerprint (for logging).
        var serverFingerprint = FingerprintBuilder.Build(context);

        // 3. Read client fingerprint: cookie (primary) → header (fallback).
        string? clientFingerprint = null;
        if (context.Request.Cookies.TryGetValue(r_options.ClientFingerprintCookie, out var cookieFp)
            && cookieFp.Truthy())
        {
            clientFingerprint = cookieFp;
        }
        else if (context.Request.Headers.TryGetValue(
                     r_options.ClientFingerprintHeader,
                     out var fingerprintHeader))
        {
            clientFingerprint = fingerprintHeader.FirstOrDefault();
        }

        if (clientFingerprint is not null && clientFingerprint.Length > r_options.MaxFingerprintLength)
        {
            clientFingerprint = clientFingerprint[..r_options.MaxFingerprintLength];
        }

        if (clientFingerprint.Falsey())
        {
            clientFingerprint = null;
            LogClientFingerprintMissing(r_logger);
        }

        // 4. Compute combined device fingerprint (always present).
        var deviceFingerprint = FingerprintBuilder.BuildDeviceFingerprint(
            clientFingerprint, serverFingerprint, clientIp);

        // 5. Build initial request context (without WhoIs data).
        var requestContext = new MutableRequestContext
        {
            TraceId = Activity.Current?.TraceId.ToString(),
            RequestId = context.TraceIdentifier,
            RequestPath = context.Request.Path.Value,
            ClientIp = clientIp,
            ServerFingerprint = serverFingerprint,
            ClientFingerprint = clientFingerprint,
            DeviceFingerprint = deviceFingerprint,
        };

        // 6. Perform WhoIs lookup if enabled and not localhost.
        if (r_options.EnableWhoIsLookup && !IpResolver.IsLocalhost(clientIp))
        {
            try
            {
                var whoIsResult = await whoIsHandler.HandleAsync(
                    new IComplex.FindWhoIsInput(clientIp),
                    context.RequestAborted);

                if (whoIsResult.CheckSuccess(out var output) && output?.WhoIs is { } whoIs)
                {
                    requestContext = new MutableRequestContext
                    {
                        TraceId = requestContext.TraceId,
                        RequestId = requestContext.RequestId,
                        RequestPath = requestContext.RequestPath,
                        ClientIp = clientIp,
                        ServerFingerprint = serverFingerprint,
                        ClientFingerprint = clientFingerprint,
                        DeviceFingerprint = deviceFingerprint,
                        WhoIsHashId = whoIs.HashId,
                        City = whoIs.Location?.City,
                        CountryCode = whoIs.Location?.CountryIso31661Alpha2Code,
                        SubdivisionCode = whoIs.Location?.SubdivisionIso31662Code,
                        IsVpn = whoIs.IsVpn,
                        IsProxy = whoIs.IsProxy,
                        IsTor = whoIs.IsTor,
                        IsHosting = whoIs.IsHosting,
                    };

                    // Do not log raw clientIp — it is PII. City/Country are non-identifying.
                    LogWhoIsEnriched(r_logger, whoIs.Location?.City, whoIs.Location?.CountryIso31661Alpha2Code);
                }
                else
                {
                    // Do not log raw clientIp — it is PII.
                    LogWhoIsNoData(r_logger);
                }
            }
            catch (Exception ex)
            {
                // Fail-open: log warning and continue without WhoIs data.
                // Do not log raw clientIp — it is PII.
                LogWhoIsLookupFailed(r_logger, ex);
            }
        }

        // 7. Store in HttpContext.Features for downstream middleware and handlers.
        context.Features.Set<IRequestContext>(requestContext);

        // 8. Continue pipeline.
        await r_next(context);
    }

    /// <summary>
    /// Logs that the client fingerprint is missing from the request.
    /// </summary>
    [LoggerMessage(EventId = 1, Level = LogLevel.Warning, Message = "Client fingerprint missing (no d2-cfp cookie or X-Client-Fingerprint header). Device rate-limit bucket will be shared.")]
    private static partial void LogClientFingerprintMissing(ILogger logger);

    /// <summary>
    /// Logs that the request was enriched with WhoIs data.
    /// </summary>
    [LoggerMessage(EventId = 2, Level = LogLevel.Debug, Message = "Enriched request with WhoIs data. City: {City}, Country: {Country}")]
    private static partial void LogWhoIsEnriched(ILogger logger, string? city, string? country);

    /// <summary>
    /// Logs that the WhoIs lookup returned no data.
    /// </summary>
    [LoggerMessage(EventId = 3, Level = LogLevel.Debug, Message = "WhoIs lookup returned no data")]
    private static partial void LogWhoIsNoData(ILogger logger);

    /// <summary>
    /// Logs that the WhoIs lookup failed.
    /// </summary>
    [LoggerMessage(EventId = 4, Level = LogLevel.Warning, Message = "WhoIs lookup failed. Proceeding without WhoIs data.")]
    private static partial void LogWhoIsLookupFailed(ILogger logger, Exception ex);
}
