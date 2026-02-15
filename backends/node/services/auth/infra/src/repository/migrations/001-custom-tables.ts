import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Creates custom auth tables not managed by BetterAuth.
 *
 * BetterAuth handles: user, account, session, verification, jwks,
 * organization, member, invitation.
 *
 * We manage: sign_in_event, emulation_consent, org_contact.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("sign_in_event")
    .addColumn("id", "varchar(36)", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(36)", (col) => col.notNull())
    .addColumn("successful", "boolean", (col) => col.notNull())
    .addColumn("ip_address", "varchar(45)", (col) => col.notNull())
    .addColumn("user_agent", "text", (col) => col.notNull())
    .addColumn("who_is_id", "varchar(64)")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("idx_sign_in_event_user_id")
    .on("sign_in_event")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("emulation_consent")
    .addColumn("id", "varchar(36)", (col) => col.primaryKey())
    .addColumn("user_id", "varchar(36)", (col) => col.notNull())
    .addColumn("granted_to_org_id", "varchar(36)", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("idx_emulation_consent_user_id")
    .on("emulation_consent")
    .column("user_id")
    .execute();

  // Partial unique index: prevent duplicate active consents for same user+org
  await sql`CREATE UNIQUE INDEX idx_emulation_consent_active_unique
    ON emulation_consent (user_id, granted_to_org_id)
    WHERE revoked_at IS NULL`.execute(db);

  await db.schema
    .createTable("org_contact")
    .addColumn("id", "varchar(36)", (col) => col.primaryKey())
    .addColumn("organization_id", "varchar(36)", (col) => col.notNull())
    .addColumn("contact_id", "varchar(36)", (col) => col.notNull())
    .addColumn("label", "varchar(100)", (col) => col.notNull())
    .addColumn("is_primary", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("idx_org_contact_organization_id")
    .on("org_contact")
    .column("organization_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("org_contact").ifExists().execute();
  await db.schema.dropTable("emulation_consent").ifExists().execute();
  await db.schema.dropTable("sign_in_event").ifExists().execute();
}
