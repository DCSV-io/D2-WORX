/**
 * PostgreSQL error code helpers for Drizzle/node-postgres.
 *
 * These predicates inspect the `code` property set by node-postgres when a
 * query violates a database constraint, enabling handlers to return
 * structured D2Result failures (409 Conflict, 422, etc.) instead of
 * propagating raw 500s.
 *
 * Drizzle 0.45+ wraps node-postgres errors in `DrizzleQueryError`, placing
 * the original `DatabaseError` (with the PG `code`) in `.cause`. These
 * helpers check both the error directly and `.cause` for compatibility.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

function hasPgCode(err: unknown, code: string): boolean {
  if (!(err instanceof Error)) return false;
  // Direct: node-postgres DatabaseError (has `code` directly)
  if ("code" in err && (err as { code: string }).code === code) return true;
  // Wrapped: Drizzle 0.45+ DrizzleQueryError (original error in `.cause`)
  const cause = err.cause;
  if (cause instanceof Error && "code" in cause && (cause as { code: string }).code === code)
    return true;
  return false;
}

/** Unique constraint violation — PG error code 23505. */
export function isPgUniqueViolation(err: unknown): boolean {
  return hasPgCode(err, "23505");
}

/** Foreign key constraint violation — PG error code 23503. */
export function isPgForeignKeyViolation(err: unknown): boolean {
  return hasPgCode(err, "23503");
}

/** NOT NULL constraint violation — PG error code 23502. */
export function isPgNotNullViolation(err: unknown): boolean {
  return hasPgCode(err, "23502");
}

/** CHECK constraint violation — PG error code 23514. */
export function isPgCheckViolation(err: unknown): boolean {
  return hasPgCode(err, "23514");
}
