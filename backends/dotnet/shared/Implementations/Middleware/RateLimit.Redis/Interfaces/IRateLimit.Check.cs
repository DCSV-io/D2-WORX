// -----------------------------------------------------------------------
// <copyright file="IRateLimit.Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Redis.Interfaces;

using D2.Shared.Handler;
using D2.Shared.RequestEnrichment;

public partial interface IRateLimit
{
    /// <summary>
    /// Handler for checking rate limits across all dimensions.
    /// </summary>
    public interface ICheckHandler : IHandler<CheckInput, CheckOutput>;

    /// <summary>
    /// Input for rate limit check.
    /// </summary>
    ///
    /// <param name="RequestInfo">
    /// The enriched request information containing IP, fingerprint, city, and country.
    /// </param>
    public record CheckInput(IRequestInfo RequestInfo);

    /// <summary>
    /// Output from rate limit check.
    /// </summary>
    ///
    /// <param name="IsBlocked">
    /// Indicates whether the request should be blocked.
    /// </param>
    /// <param name="BlockedDimension">
    /// The dimension that caused the block, if blocked.
    /// </param>
    /// <param name="RetryAfter">
    /// The time until the block expires, if blocked.
    /// </param>
    public record CheckOutput(
        bool IsBlocked,
        RateLimitDimension? BlockedDimension,
        TimeSpan? RetryAfter);
}
