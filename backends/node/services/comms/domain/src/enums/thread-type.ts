/**
 * Type of conversation thread.
 *
 * - `chat` — direct messaging between participants
 * - `support` — customer support ticket with CSR interaction
 * - `forum` — topic-based discussion (supports slugs)
 * - `system` — auto-created per-user notification thread
 */

export const THREAD_TYPES = ["chat", "support", "forum", "system"] as const;

export type ThreadType = (typeof THREAD_TYPES)[number];

export function isValidThreadType(value: unknown): value is ThreadType {
  return typeof value === "string" && THREAD_TYPES.includes(value as ThreadType);
}
