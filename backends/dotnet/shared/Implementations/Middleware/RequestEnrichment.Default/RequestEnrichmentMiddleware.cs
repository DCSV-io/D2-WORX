// -----------------------------------------------------------------------
// <copyright file="RequestEnrichmentMiddleware.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RequestEnrichment.Default;

using D2.Geo.Client.Interfaces.CQRS.Handlers.X;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

/// <summary>
/// Middleware that enriches HTTP requests with client information.
/// </summary>
/// <remarks>
/// Resolves client IP, computes fingerprints, and optionally performs WhoIs lookups.
/// The enriched information is stored in <see cref="HttpContext.Features"/> as
/// <see cref="IRequestInfo"/>.
/// </remarks>
public class RequestEnrichmentMiddleware
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
        // 1. Resolve client IP (only trusting configured proxy headers).
        var clientIp = IpResolver.Resolve(context, r_options.TrustedProxyHeaders, r_options.MaxForwardedForLength);

        // 2. Compute server fingerprint (for logging).
        var serverFingerprint = FingerprintBuilder.Build(context);

        // 3. Read client fingerprint header (for rate limiting). Truncate oversized values.
        string? clientFingerprint = null;
        if (context.Request.Headers.TryGetValue(
                r_options.ClientFingerprintHeader,
                out var fingerprintHeader))
        {
            var fp = fingerprintHeader.FirstOrDefault();
            if (fp is not null && fp.Length > r_options.MaxFingerprintLength)
            {
                fp = fp[..r_options.MaxFingerprintLength];
            }

            clientFingerprint = fp;
        }

        // 4. Build initial request info (without WhoIs data).
        var requestInfo = new RequestInfo
        {
            ClientIp = clientIp,
            ServerFingerprint = serverFingerprint,
            ClientFingerprint = clientFingerprint,
        };

        // 5. Perform WhoIs lookup if enabled and not localhost.
        if (r_options.EnableWhoIsLookup && !IpResolver.IsLocalhost(clientIp))
        {
            try
            {
                var userAgent = context.Request.Headers.UserAgent.FirstOrDefault() ?? string.Empty;

                var whoIsResult = await whoIsHandler.HandleAsync(
                    new IComplex.FindWhoIsInput(clientIp, userAgent),
                    context.RequestAborted);

                if (whoIsResult.CheckSuccess(out var output) && output?.WhoIs is { } whoIs)
                {
                    requestInfo = new RequestInfo
                    {
                        ClientIp = clientIp,
                        ServerFingerprint = serverFingerprint,
                        ClientFingerprint = clientFingerprint,
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
                    r_logger.LogDebug(
                        "Enriched request with WhoIs data. City: {City}, Country: {Country}",
                        whoIs.Location?.City,
                        whoIs.Location?.CountryIso31661Alpha2Code);
                }
                else
                {
                    // Do not log raw clientIp — it is PII.
                    r_logger.LogDebug("WhoIs lookup returned no data");
                }
            }
            catch (Exception ex)
            {
                // Fail-open: log warning and continue without WhoIs data.
                // Do not log raw clientIp — it is PII.
                r_logger.LogWarning(
                    ex,
                    "WhoIs lookup failed. Proceeding without WhoIs data.");
            }
        }

        // 6. Store in HttpContext.Features for downstream middleware and handlers.
        context.Features.Set<IRequestInfo>(requestInfo);

        // 7. Continue pipeline.
        await r_next(context);
    }
}
