/**
 * Batch delete utility for chunked purge/cleanup operations.
 * Mirrors D2.Shared.Batch.Pg.BatchDelete in .NET.
 *
 * Pattern: select IDs matching condition (LIMIT) → delete by IDs → repeat.
 * Avoids large transactions, unbounded deletes, and parameter-list overflows.
 */

/**
 * Repeatedly select a batch of IDs matching a condition, delete them,
 * and loop until exhausted.
 *
 * @param selectBatch - Selects up to `batchSize` IDs matching the delete condition.
 * @param deleteBatch - Deletes the given IDs. Must handle FK ordering if needed.
 * @param batchSize - Maximum IDs per batch.
 * @returns Total number of rows deleted.
 */
export async function batchDelete<TId>(
  selectBatch: (limit: number) => Promise<TId[]>,
  deleteBatch: (ids: TId[]) => Promise<void>,
  batchSize: number,
): Promise<number> {
  if (batchSize <= 0) {
    throw new RangeError(`batchSize must be positive, got ${batchSize}`);
  }

  let totalDeleted = 0;

  for (;;) {
    const batch = await selectBatch(batchSize);
    if (batch.length === 0) break;

    await deleteBatch(batch);
    totalDeleted += batch.length;

    if (batch.length < batchSize) break;
  }

  return totalDeleted;
}
