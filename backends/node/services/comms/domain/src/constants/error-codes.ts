/**
 * Domain-specific error codes for the Comms service.
 *
 * Convention: `COMMS_{SPECIFIC_CODE}` — prefixed to avoid clashes with
 * generic error codes from @d2/result (NOT_FOUND, UNAUTHORIZED, etc.).
 *
 * These are returned as `errorCode` in D2Result.Fail() responses.
 * The frontend maps them to localized messages via `comms_errors_{CODE}`
 * keys in the shared message catalog.
 */
export const COMMS_ERROR_CODES = {
  DELIVERY_FAILED: "COMMS_DELIVERY_FAILED",
  RECIPIENT_NOT_FOUND: "COMMS_RECIPIENT_NOT_FOUND",
  CHANNEL_UNAVAILABLE: "COMMS_CHANNEL_UNAVAILABLE",
  MAX_RETRIES_EXCEEDED: "COMMS_MAX_RETRIES_EXCEEDED",
} as const;

export type CommsErrorCode = (typeof COMMS_ERROR_CODES)[keyof typeof COMMS_ERROR_CODES];
