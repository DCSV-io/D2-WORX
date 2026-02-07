/**
 * Array utility functions.
 * Mirrors D2.Shared.Utilities.Extensions.EnumerableExtensions in .NET.
 *
 * In JavaScript, empty arrays are truthy (`Boolean([]) === true`),
 * so these helpers provide explicit "has at least one element" checks.
 */

/**
 * Checks if an array is "truthy" (not null/undefined and has at least one element).
 */
export function arrayTruthy<T>(arr: T[] | null | undefined): arr is T[] & { length: number } {
  return arr != null && arr.length > 0;
}

/**
 * Checks if an array is "falsey" (null, undefined, or empty).
 */
export function arrayFalsey<T>(arr: T[] | null | undefined): boolean {
  return !arrayTruthy(arr);
}
