import { SIGN_IN_THROTTLE } from "../constants/auth-constants.js";

/**
 * Delay curve: failure count → delay in milliseconds.
 *
 * | Failures | Delay   |
 * |----------|---------|
 * | 1–3      | None    |
 * | 4        | 5s      |
 * | 5        | 15s     |
 * | 6        | 30s     |
 * | 7        | 1m      |
 * | 8        | 5m      |
 * | 9+       | 15m max |
 */
const DELAY_CURVE_MS: readonly number[] = [
  0, // index 0 — never used (failureCount >= 1)
  0, // 1
  0, // 2
  0, // 3
  5_000, // 4
  15_000, // 5
  30_000, // 6
  60_000, // 7
  300_000, // 8
  SIGN_IN_THROTTLE.MAX_DELAY_MS, // 9+
];

/**
 * Computes the progressive delay for a given number of consecutive failures.
 *
 * Pure function — no side effects, no dependencies.
 *
 * @param failureCount - Number of consecutive failed sign-in attempts.
 * @returns Delay in milliseconds before the next attempt is allowed. Returns 0
 *   for counts within the free-attempt window (≤ 3).
 */
export function computeSignInDelay(failureCount: number): number {
  if (failureCount <= SIGN_IN_THROTTLE.FREE_ATTEMPTS) return 0;
  if (failureCount >= DELAY_CURVE_MS.length) return SIGN_IN_THROTTLE.MAX_DELAY_MS;
  return DELAY_CURVE_MS[failureCount]!;
}
