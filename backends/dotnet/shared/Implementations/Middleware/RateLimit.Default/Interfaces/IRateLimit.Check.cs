// -----------------------------------------------------------------------
// <copyright file="IRateLimit.Check.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Default.Interfaces;

using D2.Shared.Handler;

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
    /// <param name="RequestContext">
    /// The request context containing IP, fingerprint, city, country, and trust flag.
    /// </param>
    public record CheckInput(IRequestContext RequestContext);

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
