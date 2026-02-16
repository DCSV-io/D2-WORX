// -----------------------------------------------------------------------
// <copyright file="RequestHeaders.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Handler.Auth;

/// <summary>
/// Custom HTTP request header names used across the D2 platform.
/// Must match the Node.js <c>REQUEST_HEADERS</c> in <c>@d2/auth-domain</c>.
/// </summary>
public static class RequestHeaders
{
    /// <summary>Idempotency key for request deduplication.</summary>
    public const string IDEMPOTENCY_KEY = "Idempotency-Key";

    /// <summary>Client fingerprint for rate limiting.</summary>
    public const string CLIENT_FINGERPRINT = "X-Client-Fingerprint";
}
