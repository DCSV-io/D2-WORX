import type { Kysely } from "kysely";

/**
 * Drops the contact_id column from org_contact table.
 *
 * Contacts are now accessed via ext keys (contextKey="org_contact", relatedEntityId=orgContact.id).
 * The junction row's own ID is the relatedEntityId — no separate contactId needed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("org_contact").dropColumn("contact_id").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("org_contact")
    .addColumn("contact_id", "varchar(36)", (col) => col.notNull().defaultTo(""))
    .execute();
}
