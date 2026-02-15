// Custom tables (managed by us)
export { signInEvent, emulationConsent, orgContact } from "./custom-tables.js";
export type {
  SignInEventRow,
  NewSignInEvent,
  EmulationConsentRow,
  NewEmulationConsent,
  OrgContactRow,
  NewOrgContact,
} from "./types.js";

// BetterAuth-managed tables (for Drizzle adapter + migrations)
export {
  user,
  session,
  account,
  verification,
  jwks,
  organization,
  member,
  invitation,
} from "./better-auth-tables.js";
