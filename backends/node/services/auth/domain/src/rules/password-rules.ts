import { COMMON_PASSWORDS } from "../data/common-passwords.js";

export interface PasswordValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

/**
 * Pure synchronous password validation — no async, no network.
 *
 * Checks (in order — first failure wins):
 *   1. Numeric-only (e.g., "123456789012")
 *   2. Date-like (digits + date separators only, e.g., "2025-10-01", "25/01/1997")
 *   3. Common password blocklist (~1,000 entries, case-insensitive)
 *
 * Length validation is handled by BetterAuth natively (minPasswordLength / maxPasswordLength)
 * and runs BEFORE this function is called via the `hash` hook.
 */
export function validatePassword(password: string): PasswordValidationResult {
  // 1. Numeric-only — e.g. "123456789012"
  if (/^\d+$/.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_NUMERIC_ONLY",
      message: "Password cannot be only numbers.",
    };
  }

  // 2. Date-like — only digits + date separators (- / . and whitespace)
  if (/^[\d\-/.\s]+$/.test(password)) {
    return {
      valid: false,
      code: "PASSWORD_DATE_LIKE",
      message: "Password cannot be only numbers and date separators.",
    };
  }

  // 3. Common password blocklist (case-insensitive)
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      valid: false,
      code: "PASSWORD_TOO_COMMON",
      message: "This password is too common.",
    };
  }

  return { valid: true };
}
