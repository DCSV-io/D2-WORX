import { randomInt } from "node:crypto";
import { USERNAME_ADJECTIVES } from "../data/username-adjectives.js";
import { USERNAME_NOUNS } from "../data/username-nouns.js";

export const USERNAME_RULES = {
  MIN_SUFFIX: 1,
  MAX_SUFFIX: 999,
  MAX_WORD_LENGTH: 12,
  ADJECTIVE_COUNT: 4096,
  NOUN_COUNT: 4096,
} as const;

/**
 * Generates a random username in `AdjectiveNoun###` format.
 *
 * Uses `crypto.randomInt` for uniform distribution across the full
 * combinatorial space (~16.76B unique combinations).
 *
 * @returns An object with `username` (lowercase) and `displayUsername` (PascalCase).
 */
export function generateUsername(): { username: string; displayUsername: string } {
  const adjective = USERNAME_ADJECTIVES[randomInt(USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[randomInt(USERNAME_NOUNS.length)];
  const suffix = randomInt(USERNAME_RULES.MIN_SUFFIX, USERNAME_RULES.MAX_SUFFIX + 1);

  const displayUsername = `${adjective}${noun}${suffix}`;
  const username = displayUsername.toLowerCase();

  return { username, displayUsername };
}
