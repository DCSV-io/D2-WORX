/**
 * Repository interface for sign-in brute-force throttling state.
 *
 * Implemented by Redis-backed store in auth-infra.
 * Consumed by CheckSignInThrottle (query) and RecordSignInOutcome (command).
 */
export interface ISignInThrottleStore {
  /** Check if identity is known-good for this identifier. */
  isKnownGood(identifierHash: string, identityHash: string): Promise<boolean>;

  /** Get remaining lockout TTL in seconds. Returns ≤ 0 if not locked. */
  getLockedTtlSeconds(identifierHash: string, identityHash: string): Promise<number>;

  /** Mark identity as known-good (long TTL). */
  markKnownGood(identifierHash: string, identityHash: string): Promise<void>;

  /** Increment failure counter. Returns new count. Sets TTL on first failure. */
  incrementFailures(identifierHash: string, identityHash: string): Promise<number>;

  /** Set lockout with given delay in seconds. */
  setLocked(identifierHash: string, identityHash: string, delaySec: number): Promise<void>;

  /** Clear attempts + locked keys (on successful sign-in). */
  clearFailureState(identifierHash: string, identityHash: string): Promise<void>;
}
