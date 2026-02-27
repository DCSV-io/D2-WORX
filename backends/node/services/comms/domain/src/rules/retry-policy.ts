import { RETRY_POLICY } from "../constants/comms-constants.js";

/**
 * Computes the retry delay for a given attempt number.
 *
 * Indexes into RETRY_POLICY.DELAYS_MS by (attemptNumber - 1).
 * If the attempt exceeds the array length, the last delay value is used.
 *
 * | Attempt | Delay     | Cumulative |
 * |---------|-----------|------------|
 * | 1       | 5s        | 5s         |
 * | 2       | 10s       | 15s        |
 * | 3       | 30s       | 45s        |
 * | 4       | 60s (1m)  | 1m 45s     |
 * | 5–10    | 300s (5m) | up to ~32m |
 *
 * @param attemptNumber - The attempt number (1-based)
 * @returns Delay in milliseconds before the next retry
 */
export function computeRetryDelay(attemptNumber: number): number {
  const index = attemptNumber - 1;
  if (index < 0) return RETRY_POLICY.DELAYS_MS[0]!;
  if (index >= RETRY_POLICY.DELAYS_MS.length) {
    return RETRY_POLICY.DELAYS_MS[RETRY_POLICY.DELAYS_MS.length - 1]!;
  }
  return RETRY_POLICY.DELAYS_MS[index]!;
}

/**
 * Checks whether the maximum number of retry attempts has been reached.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @returns True if no more retries should be attempted
 */
export function isMaxAttemptsReached(attemptNumber: number): boolean {
  return attemptNumber >= RETRY_POLICY.MAX_ATTEMPTS;
}

/**
 * Computes the UTC timestamp for the next retry attempt.
 *
 * @param attemptNumber - The current attempt number (1-based)
 * @param now - Current UTC time (defaults to new Date() for testability)
 * @returns UTC Date when the next retry should occur
 */
export function computeNextRetryAt(attemptNumber: number, now?: Date): Date {
  const currentTime = now ?? new Date();
  const delayMs = computeRetryDelay(attemptNumber);
  return new Date(currentTime.getTime() + delayMs);
}
