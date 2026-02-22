// -----------------------------------------------------------------------
// <copyright file="Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Default.Handlers;

using D2.Shared.Handler;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.R;
using D2.Shared.Interfaces.Caching.Distributed.Handlers.U;
using D2.Shared.RequestEnrichment.Default;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using H = D2.Shared.RateLimit.Default.Interfaces.IRateLimit.ICheckHandler;
using I = D2.Shared.RateLimit.Default.Interfaces.IRateLimit.CheckInput;
using O = D2.Shared.RateLimit.Default.Interfaces.IRateLimit.CheckOutput;

/// <summary>
/// Handler for checking rate limits using sliding window approximation.
/// </summary>
/// <remarks>
/// Uses two fixed-window counters per dimension with weighted average to approximate
/// a sliding window. Uses distributed cache handlers for storage abstraction.
/// </remarks>
public class Check : BaseHandler<Check, I, O>, H
{
    private readonly IRead.IGetTtlHandler r_getTtl;
    private readonly IUpdate.IIncrementHandler r_increment;
    private readonly IUpdate.ISetHandler<string> r_set;
    private readonly RateLimitOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="Check"/> class.
    /// </summary>
    ///
    /// <param name="getTtl">
    /// The handler for getting TTL of cache keys.
    /// </param>
    /// <param name="increment">
    /// The handler for atomic increment operations.
    /// </param>
    /// <param name="set">
    /// The handler for setting cache values.
    /// </param>
    /// <param name="options">
    /// The rate limit options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Check(
        IRead.IGetTtlHandler getTtl,
        IUpdate.IIncrementHandler increment,
        IUpdate.ISetHandler<string> set,
        IOptions<RateLimitOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_getTtl = getTtl;
        r_increment = increment;
        r_set = set;
        r_options = options.Value;
    }

    /// <inheritdoc />
    protected override HandlerOptions DefaultOptions => new(LogInput: false);

    /// <summary>
    /// Checks rate limits across all dimensions.
    /// </summary>
    ///
    /// <param name="input">
    /// The input containing request information.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A <see cref="D2Result{O}"/> indicating whether the request is blocked.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        var requestInfo = input.RequestInfo;

        // Trusted services bypass all rate limiting.
        if (requestInfo.IsTrustedService)
        {
            return D2Result<O?>.Ok(new O(false, null, null));
        }

        // Check dimensions in hierarchy order: fingerprint → IP → city → country.
        // Short-circuit if any dimension is already blocked.

        // 1. Check client fingerprint (if present).
        if (!string.IsNullOrWhiteSpace(requestInfo.ClientFingerprint))
        {
            var result = await CheckDimensionAsync(
                RateLimitDimension.ClientFingerprint,
                requestInfo.ClientFingerprint,
                r_options.ClientFingerprintThreshold,
                ct);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result);
            }
        }

        // 2. Check IP (if not localhost).
        if (!IpResolver.IsLocalhost(requestInfo.ClientIp))
        {
            var result = await CheckDimensionAsync(
                RateLimitDimension.Ip,
                requestInfo.ClientIp,
                r_options.IpThreshold,
                ct);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result);
            }
        }

        // 3. Check city (if WhoIs resolved).
        if (!string.IsNullOrWhiteSpace(requestInfo.City))
        {
            var result = await CheckDimensionAsync(
                RateLimitDimension.City,
                requestInfo.City,
                r_options.CityThreshold,
                ct);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result);
            }
        }

        // 4. Check country (if WhoIs resolved and not whitelisted).
        if (!string.IsNullOrWhiteSpace(requestInfo.CountryCode) &&
            !r_options.WhitelistedCountryCodes.Contains(requestInfo.CountryCode))
        {
            var result = await CheckDimensionAsync(
                RateLimitDimension.Country,
                requestInfo.CountryCode,
                r_options.CountryThreshold,
                ct);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result);
            }
        }

        // All dimensions passed.
        return D2Result<O?>.Ok(new O(false, null, null));
    }

    /// <summary>
    /// Gets the window ID for a given timestamp.
    /// </summary>
    ///
    /// <param name="time">
    /// The timestamp.
    /// </param>
    ///
    /// <returns>
    /// A string representing the window ID (minute-granularity UTC timestamp).
    /// </returns>
    private static string GetWindowId(DateTime time)
    {
        // Use minute-granularity for 60-second windows.
        return time.ToString("yyyy-MM-ddTHH:mm");
    }

    /// <summary>
    /// Checks a single dimension using sliding window approximation.
    /// </summary>
    ///
    /// <param name="dimension">
    /// The dimension being checked.
    /// </param>
    /// <param name="value">
    /// The value for the dimension (e.g., IP address, fingerprint).
    /// </param>
    /// <param name="threshold">
    /// The maximum allowed requests per window.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// The check output indicating if blocked.
    /// </returns>
    private async Task<O> CheckDimensionAsync(
        RateLimitDimension dimension,
        string value,
        int threshold,
        CancellationToken ct)
    {
        var dimensionKey = dimension.ToString().ToLowerInvariant();
        var blockedKey = $"blocked:{dimensionKey}:{value}";

        try
        {
            // 1. Check if already blocked.
            var ttlResult = await r_getTtl.HandleAsync(new IRead.GetTtlInput(blockedKey), ct);
            if (ttlResult.CheckSuccess(out var ttlOutput) && ttlOutput?.TimeToLive.HasValue == true)
            {
                // Do not log raw `value` — it may be an IP address or fingerprint (PII).
                Context.Logger.LogDebug(
                    "Request blocked on {Dimension} dimension. TTL: {TTL}. TraceId: {TraceId}",
                    dimension,
                    ttlOutput.TimeToLive.Value,
                    TraceId);

                return new O(true, dimension, ttlOutput.TimeToLive.Value);
            }

            // 2. Get current and previous window IDs.
            var now = DateTime.UtcNow;
            var windowSeconds = (int)r_options.Window.TotalSeconds;
            var currentWindowId = GetWindowId(now);
            var previousWindowId = GetWindowId(now.AddSeconds(-windowSeconds));

            var currentKey = $"ratelimit:{dimensionKey}:{value}:{currentWindowId}";
            var previousKey = $"ratelimit:{dimensionKey}:{value}:{previousWindowId}";

            // 3. Get previous window count (increment by 0 to get current value).
            // Note: This creates the key if it doesn't exist, but with TTL it will auto-expire.
            var prevResult = await r_increment.HandleAsync(
                new IUpdate.IncrementInput(previousKey, 0, r_options.Window * 2),
                ct);
            var prevCount = prevResult.CheckSuccess(out var prevOutput) ? prevOutput?.NewValue ?? 0 : 0;

            // 4. Increment current window and get new count.
            var incrResult = await r_increment.HandleAsync(
                new IUpdate.IncrementInput(currentKey, 1, r_options.Window * 2),
                ct);

            if (!incrResult.CheckSuccess(out var incrOutput))
            {
                // Fail-open on cache errors. Do not log raw `value` — may be PII.
                Context.Logger.LogWarning(
                    "Failed to increment rate limit counter for {Dimension}. Failing open. TraceId: {TraceId}",
                    dimension,
                    TraceId);

                return new O(false, null, null);
            }

            var currCount = incrOutput?.NewValue ?? 0;

            // 5. Calculate weighted estimate.
            var secondsIntoCurrentWindow = now.Second + (now.Millisecond / 1000.0);
            var weight = 1.0 - (secondsIntoCurrentWindow / windowSeconds);
            var estimated = (long)((prevCount * weight) + currCount);

            // 6. Check if over threshold.
            if (estimated > threshold)
            {
                // Block the dimension.
                await r_set.HandleAsync(
                    new IUpdate.SetInput<string>(blockedKey, "1", r_options.BlockDuration),
                    ct);

                // Do not log raw `value` — may be an IP address or fingerprint (PII).
                Context.Logger.LogWarning(
                    "Rate limit exceeded on {Dimension} dimension. Count: {Count}/{Threshold}. TraceId: {TraceId}",
                    dimension,
                    estimated,
                    threshold,
                    TraceId);

                return new O(true, dimension, r_options.BlockDuration);
            }

            return new O(false, null, null);
        }
        catch (Exception ex)
        {
            // Fail-open on cache errors. Do not log raw `value` — may be PII.
            Context.Logger.LogWarning(
                ex,
                "Error checking rate limit for {Dimension}. Failing open. TraceId: {TraceId}",
                dimension,
                TraceId);

            return new O(false, null, null);
        }
    }
}
