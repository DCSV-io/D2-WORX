/**
 * Parses a string as a positive integer, throwing on invalid input.
 * Used by the typed config system for numeric environment variables.
 *
 * @param value - The string value to parse
 * @param name - A label for error messages (typically the env var name)
 * @returns The parsed positive integer
 * @throws {Error} If the value is not a finite positive integer
 */
export function parsePositiveInt(value: string, name: string): number {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid config "${name}": "${value}" — must be a positive integer`);
  }
  return parsed;
}
