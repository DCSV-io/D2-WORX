// -----------------------------------------------------------------------
// <copyright file="RateLimitDimension.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.RateLimit.Default;

/// <summary>
/// Represents a dimension used for rate limiting.
/// </summary>
public enum RateLimitDimension
{
    /// <summary>
    /// Rate limit by combined device fingerprint: SHA-256(clientFP + serverFP + clientIp).
    /// Always evaluated (device fingerprint is always present).
    /// </summary>
    DeviceFingerprint,

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
