// -----------------------------------------------------------------------
// <copyright file="RetryOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.Retry;

/// <summary>
/// Configuration options for the generic retry utility.
/// </summary>
/// <typeparam name="T">The return type of the operation being retried.</typeparam>
public record RetryOptions<T>
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
    /// Gets a delegate that inspects a returned value to decide whether to retry.
    /// Default: never retry returns (all returned values are accepted).
    /// </summary>
    public Func<T, bool>? ShouldRetry { get; init; }

    /// <summary>
    /// Gets a delegate that inspects a thrown exception to decide whether to retry.
    /// Default: <see cref="RetryHelper.IsTransientException"/>.
    /// </summary>
    public Func<Exception, bool>? IsTransient { get; init; }

    /// <summary>
    /// Gets an optional delay function override for testing. Default: <see cref="Task.Delay(TimeSpan, CancellationToken)"/>.
    /// </summary>
    /// <remarks>Not intended for production use.</remarks>
    public Func<TimeSpan, CancellationToken, Task>? DelayFunc { get; init; }
}
