/**
 * Shared test helper utilities.
 * Mirrors TestHelpers.cs from .NET shared tests.
 */

/**
 * Generate a random trace ID string for testing.
 * Mimics the pattern used in .NET's TestHelpers.CreateHandlerContext().
 */
export function createTraceId(): string {
  return crypto.randomUUID();
}
