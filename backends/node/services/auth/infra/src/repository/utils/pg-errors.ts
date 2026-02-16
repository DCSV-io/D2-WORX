/**
 * Checks whether an error is a PostgreSQL unique constraint violation (code 23505).
 */
export function isPgUniqueViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as { code: string }).code === "23505";
}
