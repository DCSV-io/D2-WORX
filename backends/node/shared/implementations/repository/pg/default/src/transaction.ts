/**
 * Transaction helper integrating Drizzle's native db.transaction() with D2Result.
 * Mirrors D2.Shared.Transactions.Pg conceptually, but uses Drizzle's ergonomic API
 * instead of handler-based Begin/Commit/Rollback (which would be over-engineering).
 *
 * Drizzle auto-commits on success and auto-rollbacks on throw. This wrapper converts
 * D2Result failures into rollbacks without losing the result.
 */

import { D2Result } from "@d2/result";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/** Sentinel error used to trigger Drizzle rollback on D2Result failure. */
class TransactionRollbackSignal extends Error {
  constructor() {
    super("D2Result failure — transaction rolled back");
  }
}

/**
 * Execute a function inside a Drizzle transaction.
 *
 * - If `fn` returns a successful D2Result, the transaction commits.
 * - If `fn` returns a failed D2Result, the transaction rolls back and the result is returned.
 * - If `fn` throws, the exception propagates (Drizzle auto-rollbacks).
 *
 * @param db - Drizzle database instance.
 * @param fn - Async function receiving the transaction handle.
 * @returns The D2Result from `fn`.
 */
export async function withTransaction<T>(
  db: NodePgDatabase,
  fn: (tx: NodePgDatabase) => Promise<D2Result<T | undefined>>,
): Promise<D2Result<T | undefined>> {
  let result!: D2Result<T | undefined>;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx as unknown as NodePgDatabase);
      if (result.failed) {
        throw new TransactionRollbackSignal();
      }
    });
    return result;
  } catch (err) {
    if (err instanceof TransactionRollbackSignal) {
      return result;
    }
    throw err;
  }
}
