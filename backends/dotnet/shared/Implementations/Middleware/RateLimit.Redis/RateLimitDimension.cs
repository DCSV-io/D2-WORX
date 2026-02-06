// -----------------------------------------------------------------------
// <copyright file="RateLimitDimension.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Redis;

/// <summary>
/// Represents a dimension used for rate limiting.
/// </summary>
public enum RateLimitDimension
{
    /// <summary>
    /// Rate limit by client-provided fingerprint (from X-Client-Fingerprint header).
    /// </summary>
    ClientFingerprint,

    /// <summary>
    /// Rate limit by client IP address.
    /// </summary>
    Ip,

    /// <summary>
    /// Rate limit by city (from WhoIs data).
    /// </summary>
    City,

    /// <summary>
    /// Rate limit by country (from WhoIs data).
    /// </summary>
    Country,
}
