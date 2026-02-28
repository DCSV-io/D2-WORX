/**
 * D2Result mapping utilities for batch query results.
 * Mirrors D2.Shared.Batch.Pg.D2ResultExtensions in .NET.
 *
 * Maps query results to the standard partial-success pattern:
 *   - Empty input → Ok([])       (nothing requested, nothing to do)
 *   - Zero results → NotFound    (none of the requested items were found)
 *   - Partial → SomeFound        (some items found, data still returned)
 *   - All found → Ok             (everything requested was found)
 */

import { D2Result } from "@d2/result";

/**
 * Map a batch query result array to a D2Result with partial-success semantics.
 *
 * @param results - The query results.
 * @param requestedCount - Number of unique IDs that were requested (after dedup/filter).
 * @returns D2Result with Ok, SomeFound, or NotFound status.
 */
export function toBatchResult<T>(results: T[], requestedCount: number): D2Result<T[] | undefined> {
  if (requestedCount === 0) {
    return D2Result.ok({ data: [] });
  }
  if (results.length === 0) {
    return D2Result.notFound();
  }
  if (results.length < requestedCount) {
    return D2Result.someFound({ data: results });
  }
  return D2Result.ok({ data: results });
}

/**
 * Map a batch query result Map to a D2Result with partial-success semantics.
 *
 * @param results - The query results as a Map.
 * @param requestedCount - Number of unique keys that were requested (after dedup/filter).
 * @returns D2Result with Ok, SomeFound, or NotFound status.
 */
export function toBatchDictionaryResult<TKey, TValue>(
  results: Map<TKey, TValue>,
  requestedCount: number,
): D2Result<Map<TKey, TValue> | undefined> {
  if (requestedCount === 0) {
    return D2Result.ok({ data: new Map() });
  }
  if (results.size === 0) {
    return D2Result.notFound();
  }
  if (results.size < requestedCount) {
    return D2Result.someFound({ data: results });
  }
  return D2Result.ok({ data: results });
}
