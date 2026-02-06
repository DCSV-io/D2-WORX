/**
 * String utility functions.
 * Mirrors D2.Shared.Utilities.Extensions.StringExtensions in .NET.
 */

const WHITESPACE_RE = /\s+/g;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NON_DIGITS_RE = /[^\d]/g;

/**
 * Cleans a string by trimming leading/trailing whitespace and collapsing
 * duplicate whitespace into a single space.
 *
 * Returns `undefined` if the input is null, undefined, empty, or whitespace-only.
 */
export function cleanStr(str: string | null | undefined): string | undefined {
  const trimmed = str?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(WHITESPACE_RE, ' ');
}

/**
 * Cleans, normalizes, and validates the basic structure of an email address.
 *
 * @returns A normalized, cleaned, lowercased email address.
 * @throws {Error} If the email is null, empty, whitespace, or not in a valid format.
 */
export function cleanAndValidateEmail(email: string | null | undefined): string {
  const cleaned = cleanStr(email)?.toLowerCase();
  if (!cleaned || !EMAIL_RE.test(cleaned)) {
    throw new Error('Invalid email address format.');
  }
  return cleaned;
}

/**
 * Cleans and normalizes a phone number by removing all non-digit characters
 * and validating its length.
 *
 * @returns A normalized phone number (E.164 format — digits only, no leading "+").
 * @throws {Error} If the phone number is null, empty, or has fewer than 7 or more than 15 digits.
 */
export function cleanAndValidatePhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber?.trim()) {
    throw new Error('Phone number cannot be null or empty.');
  }

  const cleaned = phoneNumber.replace(NON_DIGITS_RE, '');

  if (!cleaned) {
    throw new Error('Invalid phone number format.');
  }

  if (cleaned.length < 7 || cleaned.length > 15) {
    throw new Error('Phone number must be between 7 and 15 digits in length.');
  }

  return cleaned;
}

/**
 * Generates a normalized string for hashing by cleaning and lowercasing each part,
 * then joining them with a pipe ("|") character.
 *
 * @example
 * getNormalizedStrForHashing([' Test One ', '   ', 'TEST3'])
 * // Returns: 'test one||test3'
 */
export function getNormalizedStrForHashing(parts: (string | null | undefined)[]): string {
  return parts.map((p) => cleanStr(p)?.toLowerCase() ?? '').join('|');
}
