// -----------------------------------------------------------------------
// <copyright file="Singleflight.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.Singleflight;

using System.Collections.Concurrent;

/// <summary>
/// Deduplicates concurrent in-flight async operations by key.
/// </summary>
/// <remarks>
/// The first caller for a given key executes the operation; subsequent callers
/// for the same key share the same <see cref="Task"/>. Once the operation
/// completes (success or failure), the key is removed — it is NOT a cache.
/// <para>
/// Thread-safe via <see cref="ConcurrentDictionary{TKey,TValue}"/> and
/// <see cref="Lazy{T}"/> with <see cref="LazyThreadSafetyMode.ExecutionAndPublication"/>.
/// </para>
/// </remarks>
public class Singleflight
{
    private readonly ConcurrentDictionary<string, Lazy<Task<object?>>> r_inflight = new();

    /// <summary>
    /// Gets the number of currently in-flight operations.
    /// </summary>
    public int Size => r_inflight.Count;

    /// <summary>
    /// Executes the operation for the given key. If an operation is already
    /// in-flight for that key, returns the existing result instead of starting
    /// a new one.
    /// </summary>
    /// <typeparam name="T">The result type of the operation.</typeparam>
    /// <param name="key">The deduplication key.</param>
    /// <param name="operation">The async operation to execute.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The operation result.</returns>
    public async ValueTask<T> ExecuteAsync<T>(
        string key,
        Func<CancellationToken, ValueTask<T>> operation,
        CancellationToken ct = default)
    {
        var lazy = r_inflight.GetOrAdd(
            key,
            _ => new Lazy<Task<object?>>(
                () => RunAsync(key, operation, ct),
                LazyThreadSafetyMode.ExecutionAndPublication));

        return (T)(await lazy.Value)!;
    }

    private async Task<object?> RunAsync<T>(
        string key,
        Func<CancellationToken, ValueTask<T>> operation,
        CancellationToken ct)
    {
        try
        {
            return await operation(ct);
        }
        finally
        {
            r_inflight.TryRemove(key, out _);
        }
    }
}
