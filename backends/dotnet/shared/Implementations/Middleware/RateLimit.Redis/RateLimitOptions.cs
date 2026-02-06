// -----------------------------------------------------------------------
// <copyright file="RateLimitOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Redis;

/// <summary>
/// Configuration options for rate limiting middleware.
/// </summary>
public class RateLimitOptions
{
    /// <summary>
    /// Gets or sets the sliding window size for rate limiting.
    /// </summary>
    /// <remarks>
    /// Default is 1 minute.
    /// </remarks>
    public TimeSpan Window { get; set; } = TimeSpan.FromMinutes(1);

    /// <summary>
    /// Gets or sets the duration to block a client after exceeding the rate limit.
    /// </summary>
    /// <remarks>
    /// Default is 5 minutes.
    /// </remarks>
    public TimeSpan BlockDuration { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Gets or sets the maximum requests per window for client fingerprint dimension.
    /// </summary>
    /// <remarks>
    /// Strictest limit — single device. Default is 100 requests per minute.
    /// Skipped if X-Client-Fingerprint header is not present.
    /// </remarks>
    public int ClientFingerprintThreshold { get; set; } = 100;

    /// <summary>
    /// Gets or sets the maximum requests per window for IP dimension.
    /// </summary>
    /// <remarks>
    /// Approximately 50 devices × 100 requests. Default is 5,000 requests per minute.
    /// Skipped for localhost/loopback addresses.
    /// </remarks>
    public int IpThreshold { get; set; } = 5_000;

    /// <summary>
    /// Gets or sets the maximum requests per window for city dimension.
    /// </summary>
    /// <remarks>
    /// Approximately 250 devices × 100 requests. Default is 25,000 requests per minute.
    /// Skipped if WhoIs data is not available.
    /// </remarks>
    public int CityThreshold { get; set; } = 25_000;

    /// <summary>
    /// Gets or sets the maximum requests per window for country dimension.
    /// </summary>
    /// <remarks>
    /// Approximately 1,000 devices × 100 requests. Default is 100,000 requests per minute.
    /// Skipped if country is in the whitelist or WhoIs data is not available.
    /// </remarks>
    public int CountryThreshold { get; set; } = 100_000;

    /// <summary>
    /// Gets or sets the list of whitelisted country codes (ISO 3166-1 alpha-2).
    /// </summary>
    /// <remarks>
    /// Countries in this list are exempt from country-level rate limiting.
    /// Default includes US, CA, GB.
    /// </remarks>
    public List<string> WhitelistedCountryCodes { get; set; } = ["US", "CA", "GB"];
}
