import type { Generated, Insertable, Selectable, Updateable } from "kysely";

/**
 * Kysely type definitions for custom auth tables.
 *
 * BetterAuth manages user, account, session, verification, jwks,
 * organization, member, and invitation tables. These are the
 * additional custom tables managed directly via Kysely.
 */

export interface SignInEventTable {
  id: string;
  user_id: string;
  successful: boolean;
  ip_address: string;
  user_agent: string;
  who_is_id: string | null;
  created_at: Generated<Date>;
}

export interface EmulationConsentTable {
  id: string;
  user_id: string;
  granted_to_org_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

export interface OrgContactTable {
  id: string;
  organization_id: string;
  label: string;
  is_primary: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

/** Database schema for Kysely — only our custom tables. */
export interface AuthCustomDatabase {
  sign_in_event: SignInEventTable;
  emulation_consent: EmulationConsentTable;
  org_contact: OrgContactTable;
}

// Convenience types for each table
export type SignInEventRow = Selectable<SignInEventTable>;
export type NewSignInEvent = Insertable<SignInEventTable>;

export type EmulationConsentRow = Selectable<EmulationConsentTable>;
export type NewEmulationConsent = Insertable<EmulationConsentTable>;
export type EmulationConsentUpdate = Updateable<EmulationConsentTable>;

export type OrgContactRow = Selectable<OrgContactTable>;
export type NewOrgContact = Insertable<OrgContactTable>;
export type OrgContactUpdate = Updateable<OrgContactTable>;
