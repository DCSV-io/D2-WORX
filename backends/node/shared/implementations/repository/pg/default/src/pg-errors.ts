/**
 * PostgreSQL error code helpers for Drizzle/node-postgres.
 *
 * These predicates inspect the `code` property set by node-postgres when a
 * query violates a database constraint, enabling handlers to return
 * structured D2Result failures (409 Conflict, 422, etc.) instead of
 * propagating raw 500s.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** Unique constraint violation — PG error code 23505. */
export function isPgUniqueViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as { code: string }).code === "23505";
}

/** Foreign key constraint violation — PG error code 23503. */
export function isPgForeignKeyViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as { code: string }).code === "23503";
}

/** NOT NULL constraint violation — PG error code 23502. */
export function isPgNotNullViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as { code: string }).code === "23502";
}

/** CHECK constraint violation — PG error code 23514. */
export function isPgCheckViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as { code: string }).code === "23514";
}
