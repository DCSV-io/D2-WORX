/**
 * Composable Zod 4 schema builders for common form fields.
 *
 * Each builder returns a standalone Zod schema fragment that can be composed
 * into full form schemas via `z.object({ ... })`. Keeps field validation
 * consistent across all forms.
 */
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { postcodeValidator } from "postcode-validator";

/** General name field (first/last name, city, etc.). */
export function nameField(max = 100) {
  return z.string().trim().min(1, "Required").max(max, `Must be ${max} characters or fewer`);
}

/** Email field with format validation. */
export function emailField() {
  return z.string().trim().min(1, "Required").max(254, "Email too long").email("Invalid email address");
}

/**
 * Phone field — validates full international format via libphonenumber-js.
 * The stored value should be in E.164 format (e.g. `+15551234567`).
 */
export function phoneField() {
  return z
    .string()
    .trim()
    .min(1, "Required")
    .max(30, "Phone number too long")
    .refine((val) => isValidPhoneNumber(val), "Invalid phone number");
}

/** Optional phone field — same rules but allows empty string. */
export function phoneFieldOptional() {
  return z
    .string()
    .max(30, "Phone number too long")
    .refine((val) => !val || isValidPhoneNumber(val), "Invalid phone number")
    .optional()
    .default("");
}

/**
 * Postal/zip code field with optional country-specific validation.
 * When `countryCode` is provided, validates against that country's format.
 */
export function postcodeField(countryCode?: string) {
  const base = z.string().trim().min(1, "Required").max(20, "Postal code too long");
  if (!countryCode) return base;
  return base.refine(
    (val) => postcodeValidator(val, countryCode),
    `Invalid postal code for ${countryCode}`,
  );
}

/** Street address line. */
export function streetField(max = 200) {
  return z.string().trim().min(1, "Required").max(max, `Must be ${max} characters or fewer`);
}

/** URL field with optional protocol prefix. */
export function urlField() {
  return z
    .string()
    .max(2048, "URL too long")
    .refine((val) => !val || /^https?:\/\/.+/.test(val), "Invalid URL")
    .optional()
    .default("");
}

/**
 * Password field — mirrors auth-domain password rules (client-side subset).
 * Enforces min/max length, rejects numeric-only and date-like strings.
 * Common blocklist and HIBP stay server-side.
 */
export function passwordField(min = 12, max = 128) {
  return z
    .string()
    .min(min, `Password must be at least ${min} characters`)
    .max(max, `Password must be ${max} characters or fewer`)
    .refine((v) => !/^\d+$/.test(v), "Password cannot be only numbers")
    .refine((v) => !/^[\d\-/.\s]+$/.test(v), "Password cannot be only numbers and date separators");
}

/** Currency code field (ISO 4217 alpha-3). */
export function currencyField() {
  return z
    .string()
    .length(3, "Must be a 3-letter currency code")
    .regex(/^[A-Z]{3}$/, "Must be uppercase letters");
}
