import { generateUuidV7 } from "@d2/utilities";

/**
 * Custom ID generation hook for BetterAuth.
 *
 * All primary keys in D2-WORX use UUIDv7 (time-ordered, globally unique).
 * This replaces BetterAuth's default random ID generation.
 */
export function generateId(): string {
  return generateUuidV7();
}
