// -----------------------------------------------------------------------
// <copyright file="D2RetryConfig.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Result.Retry;

/// <summary>
/// Base retry configuration shared by clean and dirty D2Result retriers.
/// </summary>
public record D2RetryConfig
{
    /// <summary>
    /// Gets the maximum number of attempts (including the initial call). Default: 5.
    /// </summary>
    public int MaxAttempts { get; init; } = 5;

    /// <summary>
    /// Gets the base delay in milliseconds before the first retry. Default: 1000.
    /// </summary>
    public int BaseDelayMs { get; init; } = 1000;

    /// <summary>
    /// Gets the multiplier applied to the delay after each retry. Default: 2.0.
    /// </summary>
    public double BackoffMultiplier { get; init; } = 2.0;

    /// <summary>
    /// Gets the maximum delay in milliseconds. Default: 30000.
    /// </summary>
    public int MaxDelayMs { get; init; } = 30_000;

    /// <summary>
    /// Gets a value indicating whether to apply full jitter (uniform [0, calculated)). Default: true.
    /// </summary>
    public bool Jitter { get; init; } = true;

    /// <summary>
    /// Gets an optional delay function override for testing. Default: <see cref="Task.Delay(TimeSpan, CancellationToken)"/>.
    /// </summary>
    /// <remarks>Not intended for production use.</remarks>
    public Func<TimeSpan, CancellationToken, Task>? DelayFunc { get; init; }
}
