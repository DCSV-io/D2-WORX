// -----------------------------------------------------------------------
// <copyright file="CircuitBreakerOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.CircuitBreaker;

/// <summary>
/// Configuration options for the circuit breaker.
/// </summary>
public record CircuitBreakerOptions
{
    /// <summary>
    /// Gets the number of consecutive failures before opening the circuit. Default: 5.
    /// </summary>
    public int FailureThreshold { get; init; } = 5;

    /// <summary>
    /// Gets the duration the circuit stays open before probing. Default: 30 seconds.
    /// </summary>
    public TimeSpan CooldownDuration { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Gets an optional clock override for testing. Must return milliseconds.
    /// Default: <see cref="Environment.TickCount64"/>.
    /// </summary>
    /// <remarks>Not intended for production use.</remarks>
    public Func<long>? NowFunc { get; init; }
}
