/**
 * Parses indexed environment variables into an array.
 * Reads `${prefix}__0`, `${prefix}__1`, ... until a gap is found.
 * Matches .NET's indexed-array binding convention.
 *
 * @example
 * ```ts
 * // Given: AUTH_API_KEYS__0=key-a, AUTH_API_KEYS__1=key-b
 * parseEnvArray("AUTH_API_KEYS"); // => ["key-a", "key-b"]
 * ```
 */
export function parseEnvArray(prefix: string): string[] {
  const result: string[] = [];
  for (let i = 0; ; i++) {
    const value = process.env[`${prefix}__${i}`];
    if (value === undefined) break;
    result.push(value);
  }
  return result;
}
