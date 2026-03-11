// -----------------------------------------------------------------------
// <copyright file="CircuitState.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.CircuitBreaker;

/// <summary>
/// Represents the state of a circuit breaker.
/// </summary>
public enum CircuitState
{
    /// <summary>Normal operation — calls pass through, failures tracked.</summary>
    Closed = 0,

    /// <summary>Fast-fail — calls rejected immediately, waiting for cooldown.</summary>
    Open = 1,

    /// <summary>Probing — one call allowed through to test recovery.</summary>
    HalfOpen = 2,
}
