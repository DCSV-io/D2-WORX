// -----------------------------------------------------------------------
// <copyright file="CircuitBreaker.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.CircuitBreaker;

/// <summary>
/// Lightweight circuit breaker for protecting async operations against sustained
/// downstream failures. Tracks consecutive failures and fast-fails when a
/// threshold is reached, avoiding wasted timeout waits.
/// </summary>
/// <typeparam name="T">The return type of the protected operation.</typeparam>
/// <remarks>
/// Thread-safe via <see cref="Interlocked"/> operations — no locks required.
/// The probe-in-flight flag ensures only one HALF_OPEN probe runs at a time.
/// </remarks>
public class CircuitBreaker<T>
{
    private readonly Func<T, bool> r_isFailure;
    private readonly int r_failureThreshold;
    private readonly long r_cooldownMs;
    private readonly Func<long> r_now;
    private readonly Action<CircuitState, CircuitState>? r_onStateChange;

    private int _state; // CircuitState cast to int for Interlocked
    private int _failureCount;
    private long _openedAt;
    private int _probeInFlight; // 0 or 1

    /// <summary>
    /// Initializes a new instance of the <see cref="CircuitBreaker{T}"/> class.
    /// </summary>
    ///
    /// <param name="isFailure">
    /// Predicate that inspects a returned value to determine if it is a failure.
    /// Only thrown exceptions count as failures by default; use this to also
    /// count result-based failures (e.g., <c>r => !r.Success</c>).
    /// </param>
    /// <param name="options">Optional configuration. Uses defaults if null.</param>
    /// <param name="onStateChange">Optional callback fired on state transitions.</param>
    public CircuitBreaker(
        Func<T, bool> isFailure,
        CircuitBreakerOptions? options = null,
        Action<CircuitState, CircuitState>? onStateChange = null)
    {
        r_isFailure = isFailure;
        r_failureThreshold = options?.FailureThreshold ?? 5;
        r_cooldownMs = (long)(options?.CooldownDuration ?? TimeSpan.FromSeconds(30)).TotalMilliseconds;
        r_now = options?.NowFunc ?? (() => Environment.TickCount64);
        r_onStateChange = onStateChange;
    }

    /// <summary>
    /// Gets the current circuit state.
    /// </summary>
    public CircuitState State => (CircuitState)Volatile.Read(ref _state);

    /// <summary>
    /// Gets the current consecutive failure count.
    /// </summary>
    public int FailureCount => Volatile.Read(ref _failureCount);

    /// <summary>
    /// Executes an operation through the circuit breaker.
    /// </summary>
    ///
    /// <param name="operation">The async operation to protect.</param>
    /// <param name="fallback">Optional fallback when the circuit is open.</param>
    /// <param name="ct">Cancellation token.</param>
    ///
    /// <returns>The operation result, or the fallback result when open.</returns>
    ///
    /// <exception cref="CircuitOpenException">
    /// Thrown when the circuit is open and no fallback is provided.
    /// </exception>
    public async ValueTask<T> ExecuteAsync(
        Func<CancellationToken, ValueTask<T>> operation,
        Func<ValueTask<T>>? fallback = null,
        CancellationToken ct = default)
    {
        // Check for OPEN → HALF_OPEN transition
        if (State == CircuitState.Open)
        {
            var elapsed = r_now() - Interlocked.Read(ref _openedAt);
            if (elapsed >= r_cooldownMs)
            {
                // Try to transition to HALF_OPEN (only one thread wins)
                if (Interlocked.CompareExchange(ref _state, (int)CircuitState.HalfOpen, (int)CircuitState.Open) == (int)CircuitState.Open)
                {
                    r_onStateChange?.Invoke(CircuitState.Open, CircuitState.HalfOpen);
                }
            }
        }

        // OPEN: fast-fail
        if (State == CircuitState.Open)
        {
            if (fallback is not null)
            {
                return await fallback();
            }

            throw new CircuitOpenException();
        }

        // HALF_OPEN: allow one probe, others get fallback
        if (State == CircuitState.HalfOpen)
        {
            if (Interlocked.CompareExchange(ref _probeInFlight, 1, 0) != 0)
            {
                // Another thread is already probing
                if (fallback is not null)
                {
                    return await fallback();
                }

                throw new CircuitOpenException();
            }
        }

        // CLOSED or HALF_OPEN probe: execute the operation
        try
        {
            var result = await operation(ct);

            if (r_isFailure(result))
            {
                RecordFailure();
                return result;
            }

            RecordSuccess();
            return result;
        }
        catch
        {
            RecordFailure();
            throw;
        }
    }

    /// <summary>
    /// Manually resets the circuit to <see cref="CircuitState.Closed"/>.
    /// </summary>
    public void Reset()
    {
        Interlocked.Exchange(ref _failureCount, 0);
        Interlocked.Exchange(ref _probeInFlight, 0);

        var prev = (CircuitState)Interlocked.Exchange(ref _state, (int)CircuitState.Closed);
        if (prev != CircuitState.Closed)
        {
            r_onStateChange?.Invoke(prev, CircuitState.Closed);
        }
    }

    private void RecordSuccess()
    {
        Interlocked.Exchange(ref _failureCount, 0);
        Interlocked.Exchange(ref _probeInFlight, 0);

        var prev = (CircuitState)Interlocked.Exchange(ref _state, (int)CircuitState.Closed);
        if (prev != CircuitState.Closed)
        {
            r_onStateChange?.Invoke(prev, CircuitState.Closed);
        }
    }

    private void RecordFailure()
    {
        var count = Interlocked.Increment(ref _failureCount);
        Interlocked.Exchange(ref _probeInFlight, 0);

        if (State == CircuitState.HalfOpen)
        {
            // Probe failed — back to OPEN
            Interlocked.Exchange(ref _openedAt, r_now());
            var prev = (CircuitState)Interlocked.Exchange(ref _state, (int)CircuitState.Open);
            if (prev != CircuitState.Open)
            {
                r_onStateChange?.Invoke(prev, CircuitState.Open);
            }

            return;
        }

        if (count >= r_failureThreshold)
        {
            Interlocked.Exchange(ref _openedAt, r_now());
            var prev = (CircuitState)Interlocked.Exchange(ref _state, (int)CircuitState.Open);
            if (prev != CircuitState.Open)
            {
                r_onStateChange?.Invoke(prev, CircuitState.Open);
            }
        }
    }
}
