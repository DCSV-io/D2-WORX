/**
 * Lifecycle state of a thread.
 *
 * State machine:
 * - active → archived | closed
 * - archived → active | closed
 * - closed (terminal — cannot reopen)
 */

export const THREAD_STATES = ["active", "archived", "closed"] as const;

export type ThreadState = (typeof THREAD_STATES)[number];

export function isValidThreadState(value: unknown): value is ThreadState {
  return typeof value === "string" && THREAD_STATES.includes(value as ThreadState);
}

/**
 * Valid state transitions for threads.
 * "closed" is terminal — a closed thread cannot be reopened.
 */
export const THREAD_STATE_TRANSITIONS: Readonly<Record<ThreadState, readonly ThreadState[]>> = {
  active: ["archived", "closed"],
  archived: ["active", "closed"],
  closed: [],
};
