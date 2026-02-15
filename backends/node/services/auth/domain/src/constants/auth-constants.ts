/**
 * JWT claim type names used across the D2 platform.
 * Must match .NET JwtClaimTypes in D2.Shared.Handler.Auth.
 */
export const JWT_CLAIM_TYPES = {
  SUB: "sub",
  EMAIL: "email",
  NAME: "name",
  ORG_ID: "orgId",
  ORG_NAME: "orgName",
  ORG_TYPE: "orgType",
  ROLE: "role",
  EMULATED_ORG_ID: "emulatedOrgId",
  EMULATED_ORG_NAME: "emulatedOrgName",
  EMULATED_ORG_TYPE: "emulatedOrgType",
  IS_EMULATING: "isEmulating",
  IMPERSONATED_BY: "impersonatedBy",
  IS_IMPERSONATING: "isImpersonating",
  FINGERPRINT: "fp",
} as const;

/**
 * Session field names — BetterAuth additionalFields on the session object.
 * Used when reading/writing custom session data.
 */
export const SESSION_FIELDS = {
  ACTIVE_ORG_TYPE: "activeOrganizationType",
  ACTIVE_ORG_ROLE: "activeOrganizationRole",
  ACTIVE_ORG_ID: "activeOrganizationId",
  EMULATED_ORG_ID: "emulatedOrganizationId",
  EMULATED_ORG_TYPE: "emulatedOrganizationType",
} as const;

/**
 * Authorization policy names — shared between Node.js and .NET.
 * Must match .NET AuthPolicies in D2.Shared.Handler.Auth.
 */
export const AUTH_POLICIES = {
  AUTHENTICATED: "Authenticated",
  HAS_ACTIVE_ORG: "HasActiveOrg",
  STAFF_ONLY: "StaffOnly",
  ADMIN_ONLY: "AdminOnly",
} as const;

/**
 * Custom HTTP request header names used across the D2 platform.
 * Must match .NET RequestHeaders in D2.Shared.Handler.Auth.
 */
export const REQUEST_HEADERS = {
  IDEMPOTENCY_KEY: "Idempotency-Key",
  CLIENT_FINGERPRINT: "X-Client-Fingerprint",
} as const;
