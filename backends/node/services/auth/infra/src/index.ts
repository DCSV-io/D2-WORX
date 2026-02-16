// @d2/auth-infra — BetterAuth configuration, repositories, and storage adapters.
// This is the ONLY package that imports better-auth.

// --- Auth Factory ---
export { createAuth } from "./auth/better-auth/auth-factory.js";
export type { Auth, AuthHooks } from "./auth/better-auth/auth-factory.js";

// --- Config ---
export { AUTH_CONFIG_DEFAULTS } from "./auth/better-auth/auth-config.js";
export type { AuthServiceConfig } from "./auth/better-auth/auth-config.js";

// --- Access Control ---
export {
  ac,
  ownerPermissions,
  officerPermissions,
  agentPermissions,
  auditorPermissions,
} from "./auth/better-auth/access-control.js";

// --- Secondary Storage ---
export { createSecondaryStorage } from "./auth/better-auth/secondary-storage.js";

// --- Hooks ---
export { generateId } from "./auth/better-auth/hooks/id-hooks.js";
export { beforeCreateOrganization } from "./auth/better-auth/hooks/org-hooks.js";
export { ensureUsername } from "./auth/better-auth/hooks/username-hooks.js";
export {
  createPasswordFunctions,
  checkBreachedPassword,
} from "./auth/better-auth/hooks/password-hooks.js";
export type {
  PasswordFunctions,
  BreachCheckResult,
  PrefixCache,
} from "./auth/better-auth/hooks/password-hooks.js";

// --- Mappers ---
export { toDomainUser } from "./mappers/user-mapper.js";
export { toDomainOrganization } from "./mappers/org-mapper.js";
export { toDomainSession } from "./mappers/session-mapper.js";
export { toDomainMember } from "./mappers/member-mapper.js";
export { toDomainInvitation } from "./mappers/invitation-mapper.js";

// --- Repository Handler Factories ---
export {
  createSignInEventRepoHandlers,
  createEmulationConsentRepoHandlers,
  createOrgContactRepoHandlers,
} from "./repository/handlers/factories.js";

// --- Sign-In Throttle ---
export { SignInThrottleStore } from "./auth/sign-in-throttle-store.js";

// --- Drizzle Schema ---
export { signInEvent, emulationConsent, orgContact } from "./repository/schema/index.js";
export type {
  SignInEventRow,
  NewSignInEvent,
  EmulationConsentRow,
  NewEmulationConsent,
  OrgContactRow,
  NewOrgContact,
} from "./repository/schema/index.js";

// BetterAuth table schema (used by Drizzle adapter and tests)
export {
  user,
  session,
  account,
  verification,
  jwks,
  organization,
  member,
  invitation,
} from "./repository/schema/index.js";

// --- Migrations ---
export { runMigrations } from "./repository/migrate.js";
