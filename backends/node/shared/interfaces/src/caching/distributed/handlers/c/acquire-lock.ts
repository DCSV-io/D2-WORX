import type { IHandler } from "@d2/handler";

/** Input for acquiring a distributed lock. */
export interface AcquireLockInput {
  /** The lock key identifying the resource to lock. */
  key: string;
  /** A unique identifier for the lock owner (typically a UUID). */
  lockId: string;
  /** The mandatory expiration time for the lock in milliseconds. */
  expirationMs: number;
}

/** Output for acquiring a distributed lock. */
export interface AcquireLockOutput {
  /** Indicates whether the lock was acquired (true) or was already held (false). */
  acquired: boolean;
}

/** Handler for acquiring a distributed lock (SET NX with mandatory TTL). */
export type IAcquireLockHandler = IHandler<AcquireLockInput, AcquireLockOutput>;
