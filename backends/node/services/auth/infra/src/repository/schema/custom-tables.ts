import {
  pgTable,
  varchar,
  boolean,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Drizzle schema definitions for custom auth tables.
 *
 * BetterAuth manages user, account, session, verification, jwks,
 * organization, member, and invitation tables. These are the
 * additional custom tables managed directly via Drizzle.
 */

export const signInEvent = pgTable(
  "sign_in_event",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    successful: boolean("successful").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    userAgent: text("user_agent").notNull(),
    whoIsId: varchar("who_is_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_sign_in_event_user_id").on(table.userId)],
);

export const emulationConsent = pgTable(
  "emulation_consent",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    grantedToOrgId: varchar("granted_to_org_id", { length: 36 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_emulation_consent_user_id").on(table.userId),
    uniqueIndex("idx_emulation_consent_active_unique")
      .on(table.userId, table.grantedToOrgId)
      .where(sql`revoked_at IS NULL`),
  ],
);

export const orgContact = pgTable(
  "org_contact",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).notNull(),
    label: varchar("label", { length: 100 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_org_contact_organization_id").on(table.organizationId)],
);
