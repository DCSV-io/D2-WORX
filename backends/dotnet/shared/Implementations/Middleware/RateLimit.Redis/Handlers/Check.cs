// -----------------------------------------------------------------------
// <copyright file="Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Redis.Handlers;

using D2.Shared.Handler;
using D2.Shared.RateLimit.Redis.Interfaces;
using D2.Shared.RequestEnrichment;
using D2.Shared.Result;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using H = D2.Shared.RateLimit.Redis.Interfaces.IRateLimit.ICheckHandler;
using I = D2.Shared.RateLimit.Redis.Interfaces.IRateLimit.CheckInput;
using O = D2.Shared.RateLimit.Redis.Interfaces.IRateLimit.CheckOutput;

/// <summary>
/// Handler for checking rate limits using sliding window approximation.
/// </summary>
/// <remarks>
/// Uses two fixed-window counters per dimension with weighted average to approximate
/// a sliding window. No Lua scripts, just GET/INCR/EXPIRE commands.
/// </remarks>
public class Check : BaseHandler<Check, I, O>, H
{
    private readonly IConnectionMultiplexer r_redis;
    private readonly RateLimitOptions r_options;

    /// <summary>
    /// Initializes a new instance of the <see cref="Check"/> class.
    /// </summary>
    ///
    /// <param name="redis">
    /// The Redis connection multiplexer.
    /// </param>
    /// <param name="options">
    /// The rate limit options.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public Check(
        IConnectionMultiplexer redis,
        IOptions<RateLimitOptions> options,
        IHandlerContext context)
        : base(context)
    {
        r_redis = redis;
        r_options = options.Value;
    }

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

        // Fail-open: if Redis is unavailable, allow the request.
        IDatabase db;
        try
        {
            db = r_redis.GetDatabase();
        }
        catch (Exception ex)
        {
            Context.Logger.LogWarning(
                ex,
                "Redis unavailable for rate limiting. Failing open. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Ok(new O(false, null, null), traceId: TraceId);
        }

        // Check dimensions in hierarchy order: fingerprint → IP → city → country.
        // Short-circuit if any dimension is already blocked.

        // 1. Check client fingerprint (if present).
        if (!string.IsNullOrWhiteSpace(requestInfo.ClientFingerprint))
        {
            var result = await CheckDimensionAsync(
                db,
                RateLimitDimension.ClientFingerprint,
                requestInfo.ClientFingerprint,
                r_options.ClientFingerprintThreshold);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result, traceId: TraceId);
            }
        }

        // 2. Check IP (if not localhost).
        if (!IpResolver.IsLocalhost(requestInfo.ClientIp))
        {
            var result = await CheckDimensionAsync(
                db,
                RateLimitDimension.Ip,
                requestInfo.ClientIp,
                r_options.IpThreshold);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result, traceId: TraceId);
            }
        }

        // 3. Check city (if WhoIs resolved).
        if (!string.IsNullOrWhiteSpace(requestInfo.City))
        {
            var result = await CheckDimensionAsync(
                db,
                RateLimitDimension.City,
                requestInfo.City,
                r_options.CityThreshold);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result, traceId: TraceId);
            }
        }

        // 4. Check country (if WhoIs resolved and not whitelisted).
        if (!string.IsNullOrWhiteSpace(requestInfo.CountryCode) &&
            !r_options.WhitelistedCountryCodes.Contains(requestInfo.CountryCode))
        {
            var result = await CheckDimensionAsync(
                db,
                RateLimitDimension.Country,
                requestInfo.CountryCode,
                r_options.CountryThreshold);

            if (result.IsBlocked)
            {
                return D2Result<O?>.Ok(result, traceId: TraceId);
            }
        }

        // All dimensions passed.
        return D2Result<O?>.Ok(new O(false, null, null), traceId: TraceId);
    }

    /// <summary>
    /// Gets the window ID for a given timestamp.
    /// </summary>
    ///
    /// <param name="time">
    /// The timestamp.
    /// </param>
    /// <param name="windowSeconds">
    /// The window size in seconds.
    /// </param>
    ///
    /// <returns>
    /// A string representing the window ID (minute-granularity UTC timestamp).
    /// </returns>
    private static string GetWindowId(DateTime time, int windowSeconds)
    {
        // Use minute-granularity for 60-second windows.
        return time.ToString("yyyy-MM-ddTHH:mm");
    }

    /// <summary>
    /// Checks a single dimension using sliding window approximation.
    /// </summary>
    ///
    /// <param name="db">
    /// The Redis database.
    /// </param>
    /// <param name="dimension">
    /// The dimension being checked.
    /// </param>
    /// <param name="value">
    /// The value for the dimension (e.g., IP address, fingerprint).
    /// </param>
    /// <param name="threshold">
    /// The maximum allowed requests per window.
    /// </param>
    ///
    /// <returns>
    /// The check output indicating if blocked.
    /// </returns>
    private async Task<O> CheckDimensionAsync(
        IDatabase db,
        RateLimitDimension dimension,
        string value,
        int threshold)
    {
        var dimensionKey = dimension.ToString().ToLowerInvariant();
        var blockedKey = $"blocked:{dimensionKey}:{value}";

        try
        {
            // 1. Check if already blocked.
            var ttl = await db.KeyTimeToLiveAsync(blockedKey);
            if (ttl.HasValue)
            {
                Context.Logger.LogDebug(
                    "Request blocked on {Dimension} dimension. Value: {Value}. TTL: {TTL}. TraceId: {TraceId}",
                    dimension,
                    value,
                    ttl.Value,
                    TraceId);

                return new O(true, dimension, ttl.Value);
            }

            // 2. Get current and previous window IDs.
            var now = DateTime.UtcNow;
            var windowSeconds = (int)r_options.Window.TotalSeconds;
            var currentWindowId = GetWindowId(now, windowSeconds);
            var previousWindowId = GetWindowId(now.AddSeconds(-windowSeconds), windowSeconds);

            var currentKey = $"ratelimit:{dimensionKey}:{value}:{currentWindowId}";
            var previousKey = $"ratelimit:{dimensionKey}:{value}:{previousWindowId}";

            // 3. Get counts from both windows (pipelined).
            var batch = db.CreateBatch();
            var prevCountTask = batch.StringGetAsync(previousKey);
            var currCountTask = batch.StringGetAsync(currentKey);
            batch.Execute();

            var prevCount = (long)(await prevCountTask);
            var currCount = (long)(await currCountTask);

            // 4. Calculate weighted estimate.
            var secondsIntoCurrentWindow = now.Second + (now.Millisecond / 1000.0);
            var weight = 1.0 - (secondsIntoCurrentWindow / windowSeconds);
            var estimated = (long)((prevCount * weight) + currCount);

            // 5. Check if over threshold.
            if (estimated >= threshold)
            {
                // Block the dimension.
                await db.StringSetAsync(
                    blockedKey,
                    "1",
                    r_options.BlockDuration);

                Context.Logger.LogWarning(
                    "Rate limit exceeded on {Dimension} dimension. Value: {Value}. Count: {Count}/{Threshold}. TraceId: {TraceId}",
                    dimension,
                    value,
                    estimated,
                    threshold,
                    TraceId);

                return new O(true, dimension, r_options.BlockDuration);
            }

            // 6. Increment current window counter (pipelined).
            var incrBatch = db.CreateBatch();
            var incrTask = incrBatch.StringIncrementAsync(currentKey);

            // Set TTL = 2 × window to cover current + next window.
            var expireTask = incrBatch.KeyExpireAsync(currentKey, r_options.Window * 2);
            incrBatch.Execute();

            await Task.WhenAll(incrTask, expireTask);

            return new O(false, null, null);
        }
        catch (Exception ex)
        {
            // Fail-open on Redis errors.
            Context.Logger.LogWarning(
                ex,
                "Redis error checking rate limit for {Dimension}:{Value}. Failing open. TraceId: {TraceId}",
                dimension,
                value,
                TraceId);

            return new O(false, null, null);
        }
    }
}
