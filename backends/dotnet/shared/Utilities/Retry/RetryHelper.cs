// -----------------------------------------------------------------------
// <copyright file="RetryHelper.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable UnthrowableException
namespace D2.Shared.Utilities.Retry;

using System.Net.Sockets;

/// <summary>
/// Generic retry utility with exponential backoff and optional jitter.
/// </summary>
/// <remarks>
/// <para>
/// The operation receives a 1-based attempt number. On thrown exceptions,
/// <c>IsTransient</c> controls retry behavior. On returned values,
/// <c>ShouldRetry</c> controls retry behavior.
/// </para>
/// <para>
/// After all attempts are exhausted: throws the last exception (if the last
/// attempt threw) or returns the last result (if the last attempt returned).
/// </para>
/// </remarks>
public static class RetryHelper
{
    private static readonly Random sr_random = new();

    /// <summary>
    /// Determines whether the given exception represents a transient failure
    /// that may succeed on retry.
    /// </summary>
    /// <param name="ex">The exception to evaluate.</param>
    /// <returns>True if the exception is transient; otherwise, false.</returns>
    /// <remarks>
    /// <para>Checks for:</para>
    /// <list type="bullet">
    ///   <item><see cref="HttpRequestException"/> with status >= 500, 429, or 408.</item>
    ///   <item><see cref="TaskCanceledException"/> and <see cref="TimeoutException"/>.</item>
    ///   <item><see cref="SocketException"/>.</item>
    /// </list>
    /// <para>
    /// Does NOT include gRPC-specific checks to keep <c>D2.Shared.Utilities</c> free of
    /// gRPC dependencies. Callers needing gRPC awareness should pass a custom
    /// <c>IsTransient</c> predicate.
    /// </para>
    /// </remarks>
    public static bool IsTransientException(Exception ex)
    {
        return ex switch
        {
            HttpRequestException httpEx => httpEx.StatusCode switch
            {
                >= System.Net.HttpStatusCode.InternalServerError => true,
                System.Net.HttpStatusCode.TooManyRequests => true,
                System.Net.HttpStatusCode.RequestTimeout => true,
                _ => false,
            },
            TaskCanceledException => true,
            TimeoutException => true,
            SocketException => true,
            _ => false,
        };
    }

    /// <summary>
    /// Executes an operation with retry logic using exponential backoff.
    /// </summary>
    /// <typeparam name="T">The return type of the operation.</typeparam>
    /// <param name="operation">
    /// The async operation to execute. Receives a 1-based attempt number.
    /// </param>
    /// <param name="options">Retry configuration options. Uses defaults if null.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The result of the operation.</returns>
    /// <exception cref="OperationCanceledException">If the cancellation token is triggered.</exception>
    public static async ValueTask<T> RetryAsync<T>(
        Func<int, CancellationToken, ValueTask<T>> operation,
        RetryOptions<T>? options = null,
        CancellationToken ct = default)
    {
        options ??= new RetryOptions<T>();
        var shouldRetry = options.ShouldRetry ?? (_ => false);
        var isTransient = options.IsTransient ?? IsTransientException;
        var delayFunc = options.DelayFunc ?? Task.Delay;

        Exception? lastError = null;
        T? lastResult = default;
        var lastWasError = false;

        for (var attempt = 1; attempt <= options.MaxAttempts; attempt++)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var result = await operation(attempt, ct);

                if (attempt < options.MaxAttempts && shouldRetry(result))
                {
                    lastResult = result;
                    lastWasError = false;
                    await delayFunc(
                        CalculateDelay(attempt - 1, options.BaseDelayMs, options.BackoffMultiplier, options.MaxDelayMs, options.Jitter),
                        ct);
                    continue;
                }

                return result;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                lastError = ex;
                lastWasError = true;

                if (attempt < options.MaxAttempts && isTransient(ex))
                {
                    await delayFunc(
                        CalculateDelay(attempt - 1, options.BaseDelayMs, options.BackoffMultiplier, options.MaxDelayMs, options.Jitter),
                        ct);
                    continue;
                }

                throw;
            }
        }

        // All attempts exhausted
        if (lastWasError)
        {
            throw lastError!;
        }

        return lastResult!;
    }

    /// <summary>
    /// Calculates the delay for a given retry index (0-based).
    /// </summary>
    /// <param name="retryIndex">Zero-based retry index.</param>
    /// <param name="baseDelayMs">Base delay in milliseconds.</param>
    /// <param name="backoffMultiplier">Backoff multiplier.</param>
    /// <param name="maxDelayMs">Maximum delay in milliseconds.</param>
    /// <param name="jitter">Whether to apply full jitter.</param>
    /// <returns>The calculated delay as a <see cref="TimeSpan"/>.</returns>
    /// <remarks>
    /// <code>
    /// calculatedDelay = min(baseDelayMs * (backoffMultiplier ^ retryIndex), maxDelayMs)
    /// actualDelay = jitter ? random(0, calculatedDelay) : calculatedDelay
    /// </code>
    /// </remarks>
    internal static TimeSpan CalculateDelay(
        int retryIndex,
        int baseDelayMs,
        double backoffMultiplier,
        int maxDelayMs,
        bool jitter)
    {
        var calculated = Math.Min(baseDelayMs * Math.Pow(backoffMultiplier, retryIndex), maxDelayMs);
        var actual = jitter ? sr_random.NextDouble() * calculated : calculated;
        return TimeSpan.FromMilliseconds(actual);
    }
}
