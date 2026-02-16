// -----------------------------------------------------------------------
// <copyright file="IdempotencyState.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Idempotency.Default;

/// <summary>
/// Possible states when checking an idempotency key.
/// </summary>
public enum IdempotencyState
{
    /// <summary>
    /// The lock was acquired — caller should proceed with request processing.
    /// </summary>
    Acquired,

    /// <summary>
    /// Another request with the same key is currently being processed.
    /// </summary>
    InFlight,

    /// <summary>
    /// A cached response exists — replay it.
    /// </summary>
    Cached,
}
