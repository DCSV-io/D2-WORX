import { eq, desc, asc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { OrgContact } from "@d2/auth-domain";
import { orgContact } from "../schema/custom-tables.js";

/**
 * Drizzle-backed repository for org_contact records.
 */
export class OrgContactRepository {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase) {
    this.db = db;
  }

  async create(contact: OrgContact): Promise<void> {
    await this.db.insert(orgContact).values({
      id: contact.id,
      organizationId: contact.organizationId,
      label: contact.label,
      isPrimary: contact.isPrimary,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    });
  }

  async findById(id: string): Promise<OrgContact | undefined> {
    const [row] = await this.db.select().from(orgContact).where(eq(orgContact.id, id));

    return row ? toOrgContact(row) : undefined;
  }

  async findByOrgId(
    organizationId: string,
    limit?: number,
    offset?: number,
  ): Promise<OrgContact[]> {
    let query = this.db
      .select()
      .from(orgContact)
      .where(eq(orgContact.organizationId, organizationId))
      .orderBy(desc(orgContact.isPrimary), asc(orgContact.createdAt))
      .$dynamic();

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query;
    return rows.map(toOrgContact);
  }

  async update(contact: OrgContact): Promise<void> {
    await this.db
      .update(orgContact)
      .set({
        label: contact.label,
        isPrimary: contact.isPrimary,
        updatedAt: contact.updatedAt,
      })
      .where(eq(orgContact.id, contact.id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(orgContact).where(eq(orgContact.id, id));
  }
}

function toOrgContact(row: typeof orgContact.$inferSelect): OrgContact {
  return {
    id: row.id,
    organizationId: row.organizationId,
    label: row.label,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
