// -----------------------------------------------------------------------
// <copyright file="IdempotencyOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default;

/// <summary>
/// Configuration options for idempotency middleware.
/// </summary>
public class IdempotencyOptions
{
    /// <summary>
    /// Gets or sets the TTL for cached responses.
    /// </summary>
    /// <remarks>
    /// Default is 24 hours. After this period, the same idempotency key can produce a new response.
    /// </remarks>
    public TimeSpan CacheTtl { get; set; } = TimeSpan.FromHours(24);

    /// <summary>
    /// Gets or sets the TTL for the in-flight sentinel lock.
    /// </summary>
    /// <remarks>
    /// Default is 30 seconds. Acts as a safety valve if the server crashes mid-request.
    /// </remarks>
    public TimeSpan InFlightTtl { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Gets or sets the maximum response body size (in bytes) that will be cached.
    /// </summary>
    /// <remarks>
    /// Default is 1 MB. Responses exceeding this size will not be cached.
    /// </remarks>
    public int MaxBodySizeBytes { get; set; } = 1_048_576;

    /// <summary>
    /// Gets or sets the HTTP methods that the idempotency middleware applies to.
    /// </summary>
    /// <remarks>
    /// Default includes POST, PUT, PATCH, DELETE. GET, HEAD, and OPTIONS are always skipped.
    /// </remarks>
    public HashSet<string> ApplicableMethods { get; set; } =
        [HttpMethod.Post.Method, HttpMethod.Put.Method, HttpMethod.Patch.Method, HttpMethod.Delete.Method];

    /// <summary>
    /// Gets or sets a value indicating whether error responses (4xx/5xx) should be cached.
    /// </summary>
    /// <remarks>
    /// Default is false. When false, non-2xx responses remove the sentinel so clients can retry.
    /// </remarks>
    public bool CacheErrorResponses { get; set; }
}
