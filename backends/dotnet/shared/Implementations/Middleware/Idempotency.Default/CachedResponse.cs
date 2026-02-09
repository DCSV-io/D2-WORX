// -----------------------------------------------------------------------
// <copyright file="CachedResponse.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default;

/// <summary>
/// Cached HTTP response for idempotent request replay.
/// </summary>
///
/// <param name="StatusCode">
/// The HTTP status code to replay.
/// </param>
/// <param name="Body">
/// The response body (JSON string), or null if empty.
/// </param>
/// <param name="ContentType">
/// The Content-Type header, or null if not set.
/// </param>
public record CachedResponse(int StatusCode, string? Body, string? ContentType);
