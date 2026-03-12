/**
 * Domain-specific error codes for the Auth service.
 *
 * Convention: `AUTH_{SPECIFIC_CODE}` — prefixed to avoid clashes with
 * generic error codes from @d2/result (NOT_FOUND, UNAUTHORIZED, etc.).
 *
 * These are returned as `errorCode` in D2Result.Fail() responses.
 * The frontend maps them to localized messages via `auth_errors_{CODE}`
 * keys in the shared message catalog.
 */
export const AUTH_ERROR_CODES = {
  SIGN_IN_THROTTLED: "AUTH_SIGN_IN_THROTTLED",
  EMAIL_ALREADY_TAKEN: "AUTH_EMAIL_ALREADY_TAKEN",
  EMULATION_ORG_TYPE_NOT_ALLOWED: "AUTH_EMULATION_ORG_TYPE_NOT_ALLOWED",
  EMULATION_CONSENT_ALREADY_EXISTS: "AUTH_EMULATION_CONSENT_ALREADY_EXISTS",
  EMULATION_CONSENT_ALREADY_REVOKED: "AUTH_EMULATION_CONSENT_ALREADY_REVOKED",
  ORG_CONTACT_ORG_MISMATCH: "AUTH_ORG_CONTACT_ORG_MISMATCH",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
