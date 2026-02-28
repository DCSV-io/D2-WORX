import type { IHandler } from "@d2/handler";

/** Input for releasing a distributed lock. */
export interface ReleaseLockInput {
  /** The lock key identifying the resource to unlock. */
  key: string;
  /** The unique identifier of the lock owner. Must match the value used to acquire. */
  lockId: string;
}

/** Output for releasing a distributed lock. */
export interface ReleaseLockOutput {
  /** Indicates whether the lock was released (true) or was not held by this owner (false). */
  released: boolean;
}

/** Handler for releasing a distributed lock (atomic compare-and-delete). */
export type IReleaseLockHandler = IHandler<ReleaseLockInput, ReleaseLockOutput>;
