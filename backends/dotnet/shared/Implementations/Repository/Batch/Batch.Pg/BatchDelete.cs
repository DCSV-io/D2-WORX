// -----------------------------------------------------------------------
// <copyright file="BatchDelete.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Batch.Pg;

/// <summary>
/// Batch delete utility for chunked purge/cleanup operations.
/// Mirrors <c>@d2/batch-pg</c> <c>batchDelete</c> in Node.js.
/// <para>
/// Pattern: select IDs matching condition (LIMIT) → delete by IDs → repeat.
/// Avoids large transactions, unbounded deletes, and parameter-list overflows.
/// </para>
/// </summary>
public static class BatchDelete
{
    /// <summary>
    /// Repeatedly selects a batch of IDs matching a condition, deletes them,
    /// and loops until exhausted.
    /// </summary>
    ///
    /// <typeparam name="TId">
    /// The ID type used to identify records to delete.
    /// </typeparam>
    ///
    /// <param name="selectBatch">
    /// Selects up to <paramref name="batchSize"/> IDs matching the delete condition.
    /// </param>
    /// <param name="deleteBatch">
    /// Deletes the given IDs. Must handle FK ordering if needed.
    /// </param>
    /// <param name="batchSize">
    /// Maximum IDs per batch. Default: 500.
    /// </param>
    /// <param name="ct">
    /// Cancellation token.
    /// </param>
    ///
    /// <returns>
    /// Total number of rows deleted across all batches.
    /// </returns>
    public static async Task<int> ExecuteAsync<TId>(
        Func<int, CancellationToken, Task<List<TId>>> selectBatch,
        Func<List<TId>, CancellationToken, Task> deleteBatch,
        int batchSize = 500,
        CancellationToken ct = default)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(batchSize, 0);

        var totalDeleted = 0;

        while (!ct.IsCancellationRequested)
        {
            var batch = await selectBatch(batchSize, ct);

            if (batch.Count == 0)
            {
                break;
            }

            await deleteBatch(batch, ct);
            totalDeleted += batch.Count;

            if (batch.Count < batchSize)
            {
                break;
            }
        }

        ct.ThrowIfCancellationRequested();

        return totalDeleted;
    }
}
