/**
 * Batch query utilities for chunked IN-clause queries.
 * Mirrors D2.Shared.Batch.Pg.BatchQuery in .NET.
 *
 * Drizzle doesn't have EF Core's IQueryable, so the API is function-based
 * rather than a fluent builder class.
 */

export interface BatchOptions {
  /** Maximum IDs per query chunk. Default: 500. */
  batchSize?: number;
  /** Remove duplicate IDs before querying. Default: true. */
  deduplicateIds?: boolean;
  /** Remove null/undefined IDs before querying. Default: true. */
  filterNullIds?: boolean;
}

export const DEFAULT_BATCH_SIZE = 500;

/**
 * Chunk an array of IDs, run queries in parallel, and merge results.
 *
 * Applies ID deduplication and null filtering by default (matching .NET BatchOptions).
 * Each chunk is passed to `queryFn` which should execute the actual DB query.
 *
 * @param ids - The IDs to look up.
 * @param queryFn - Function that queries a chunk of IDs and returns matching results.
 * @param options - Batch configuration.
 * @returns Merged results from all chunks.
 */
export async function batchQuery<TKey, TResult>(
  ids: readonly TKey[],
  queryFn: (chunk: TKey[]) => Promise<TResult[]>,
  options?: BatchOptions,
): Promise<TResult[]> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const dedup = options?.deduplicateIds ?? true;
  const filterNull = options?.filterNullIds ?? true;

  let prepared: TKey[] = [...ids];

  if (filterNull) {
    prepared = prepared.filter((id) => id != null);
  }

  if (dedup) {
    prepared = [...new Set(prepared)];
  }

  if (prepared.length === 0) {
    return [];
  }

  // Chunk IDs into batches
  const chunks: TKey[][] = [];
  for (let i = 0; i < prepared.length; i += batchSize) {
    chunks.push(prepared.slice(i, i + batchSize));
  }

  // Execute all chunks in parallel
  const results = await Promise.all(chunks.map((chunk) => queryFn(chunk)));

  // Merge results from all chunks
  return results.flat();
}
