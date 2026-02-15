import type { signInEvent, emulationConsent, orgContact } from "./custom-tables.js";

export type SignInEventRow = typeof signInEvent.$inferSelect;
export type NewSignInEvent = typeof signInEvent.$inferInsert;

export type EmulationConsentRow = typeof emulationConsent.$inferSelect;
export type NewEmulationConsent = typeof emulationConsent.$inferInsert;

export type OrgContactRow = typeof orgContact.$inferSelect;
export type NewOrgContact = typeof orgContact.$inferInsert;
