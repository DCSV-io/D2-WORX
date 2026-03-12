/**
 * Circuit breaker states.
 *
 * ```
 * CLOSED ──(failures >= threshold)──► OPEN ──(cooldown elapsed)──► HALF_OPEN
 *   ▲                                                                  │
 *   └──────────(probe succeeds)────────────────────────────────────────┘
 *   OPEN ◄────(probe fails)───────────────────────────────────────────┘
 * ```
 */
export enum CircuitState {
  /** Normal operation — calls pass through, failures tracked. */
  CLOSED = "CLOSED",
  /** Fast-fail — calls rejected immediately, waiting for cooldown. */
  OPEN = "OPEN",
  /** Probing — one call allowed through to test recovery. */
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5. */
  failureThreshold?: number;
  /** Duration in ms the circuit stays open before probing. Default: 30000 (30s). */
  cooldownMs?: number;
  /** Predicate: is this returned value a failure? Default: always false (only thrown errors count). */
  isFailure?: (result: unknown) => boolean;
  /** Predicate: is this thrown error a failure that should count? Default: always true. */
  isFailureError?: (error: unknown) => boolean;
  /** Called on state transitions for observability. */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** @internal Override for testing — replaces Date.now(). */
  _nowFn?: () => number;
}

/**
 * Error thrown when the circuit is open and no fallback is provided.
 */
export class CircuitOpenError extends Error {
  constructor() {
    super("Circuit breaker is open");
    this.name = "CircuitOpenError";
  }
}

/**
 * Lightweight circuit breaker for protecting async operations against
 * sustained downstream failures. Tracks consecutive failures and
 * fast-fails when a threshold is reached, avoiding wasted timeout waits.
 *
 * Thread-safe for Node.js (single-threaded with async interleaving).
 * Uses a probe-in-flight flag to prevent multiple HALF_OPEN probes.
 */
export class CircuitBreaker {
  private _state: CircuitState = CircuitState.CLOSED;
  private _failureCount = 0;
  private _openedAt = 0;
  private _probeInFlight = false;

  private readonly _failureThreshold: number;
  private readonly _cooldownMs: number;
  private readonly _isFailure: (result: unknown) => boolean;
  private readonly _isFailureError: (error: unknown) => boolean;
  private readonly _onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly _now: () => number;

  constructor(options?: CircuitBreakerOptions) {
    this._failureThreshold = options?.failureThreshold ?? 5;
    this._cooldownMs = options?.cooldownMs ?? 30_000;
    this._isFailure = options?.isFailure ?? (() => false);
    this._isFailureError = options?.isFailureError ?? (() => true);
    this._onStateChange = options?.onStateChange;
    this._now = options?._nowFn ?? Date.now;
  }

  /** Current circuit state. */
  get state(): CircuitState {
    return this._state;
  }

  /** Current consecutive failure count. */
  get failureCount(): number {
    return this._failureCount;
  }

  /**
   * Execute an operation through the circuit breaker.
   *
   * - **CLOSED**: Execute normally, track failures. Opens after threshold.
   * - **OPEN**: Call fallback immediately (or throw CircuitOpenError).
   * - **HALF_OPEN**: Execute one probe. Success → CLOSED, failure → OPEN.
   *   Additional callers while probe is in-flight get the fallback.
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    // Check for OPEN → HALF_OPEN transition
    if (this._state === CircuitState.OPEN) {
      if (this._now() - this._openedAt >= this._cooldownMs) {
        this._transition(CircuitState.HALF_OPEN);
      }
    }

    // OPEN: fast-fail
    if (this._state === CircuitState.OPEN) {
      if (fallback) return fallback();
      throw new CircuitOpenError();
    }

    // HALF_OPEN: allow one probe, others get fallback
    if (this._state === CircuitState.HALF_OPEN) {
      if (this._probeInFlight) {
        if (fallback) return fallback();
        throw new CircuitOpenError();
      }
      this._probeInFlight = true;
    }

    // CLOSED or HALF_OPEN probe: execute the operation
    try {
      const result = await operation();

      if (this._isFailure(result)) {
        this._recordFailure();
        return result;
      }

      this._recordSuccess();
      return result;
    } catch (error: unknown) {
      if (this._isFailureError(error)) {
        this._recordFailure();
      }
      throw error;
    }
  }

  /** Manually reset the circuit to CLOSED state. */
  reset(): void {
    this._failureCount = 0;
    this._probeInFlight = false;
    if (this._state !== CircuitState.CLOSED) {
      this._transition(CircuitState.CLOSED);
    }
  }

  private _recordSuccess(): void {
    this._failureCount = 0;
    this._probeInFlight = false;
    if (this._state !== CircuitState.CLOSED) {
      this._transition(CircuitState.CLOSED);
    }
  }

  private _recordFailure(): void {
    this._failureCount++;
    this._probeInFlight = false;

    if (this._state === CircuitState.HALF_OPEN) {
      // Probe failed — back to OPEN
      this._openedAt = this._now();
      this._transition(CircuitState.OPEN);
      return;
    }

    if (this._failureCount >= this._failureThreshold) {
      this._openedAt = this._now();
      this._transition(CircuitState.OPEN);
    }
  }

  private _transition(to: CircuitState): void {
    const from = this._state;
    this._state = to;
    this._onStateChange?.(from, to);
  }
}
