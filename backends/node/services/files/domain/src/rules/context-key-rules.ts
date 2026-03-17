import { FILES_FIELD_LIMITS, CONTEXT_KEY_PREFIXES } from "../constants/files-constants.js";

/**
 * Regex for valid context key format:
 * - starts with lowercase letter
 * - segments of lowercase letters/digits separated by underscores
 * - e.g., "user_avatar", "org_document", "thread_attachment"
 */
const CONTEXT_KEY_RE = /^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)*$/;

/**
 * Validates the format of a context key string.
 *
 * @returns true if the key matches the required format and length constraints
 */
export function isValidContextKeyFormat(key: unknown): boolean {
  if (typeof key !== "string") return false;
  if (key.length === 0 || key.length > FILES_FIELD_LIMITS.MAX_CONTEXT_KEY_LENGTH) return false;
  return CONTEXT_KEY_RE.test(key);
}

/**
 * Resolves the prefix entry for a context key.
 *
 * @returns The matching prefix config, or null if no prefix matches
 */
export function resolveContextKeyPrefix(
  key: string,
): { prefix: string; resolution: "jwt" | "callback" } | null {
  for (const [prefixKey, config] of Object.entries(CONTEXT_KEY_PREFIXES)) {
    if (key.startsWith(prefixKey)) {
      return config;
    }
  }
  return null;
}

/**
 * Checks whether a context key requires an external access check callback
 * (as opposed to JWT-based resolution).
 */
export function requiresExternalAccessCheck(key: string): boolean {
  const prefix = resolveContextKeyPrefix(key);
  return prefix?.resolution === "callback";
}
