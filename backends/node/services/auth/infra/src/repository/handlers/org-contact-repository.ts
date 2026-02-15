import type { Kysely } from "kysely";
import type { OrgContact } from "@d2/auth-domain";
import type { AuthCustomDatabase, NewOrgContact } from "../entities/kysely-types.js";

/**
 * Kysely-based repository for org_contact records.
 */
export class OrgContactRepository {
  private readonly db: Kysely<AuthCustomDatabase>;

  constructor(db: Kysely<AuthCustomDatabase>) {
    this.db = db;
  }

  async create(contact: OrgContact): Promise<void> {
    const row: NewOrgContact = {
      id: contact.id,
      organization_id: contact.organizationId,
      label: contact.label,
      is_primary: contact.isPrimary,
      created_at: contact.createdAt,
      updated_at: contact.updatedAt,
    };

    await this.db.insertInto("org_contact").values(row).execute();
  }

  async findById(id: string): Promise<OrgContact | undefined> {
    const row = await this.db
      .selectFrom("org_contact")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toOrgContact(row) : undefined;
  }

  async findByOrgId(
    organizationId: string,
    limit?: number,
    offset?: number,
  ): Promise<OrgContact[]> {
    let query = this.db
      .selectFrom("org_contact")
      .selectAll()
      .where("organization_id", "=", organizationId)
      .orderBy("is_primary", "desc")
      .orderBy("created_at", "asc");

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query.execute();
    return rows.map(toOrgContact);
  }

  async update(contact: OrgContact): Promise<void> {
    await this.db
      .updateTable("org_contact")
      .set({
        label: contact.label,
        is_primary: contact.isPrimary,
        updated_at: contact.updatedAt,
      })
      .where("id", "=", contact.id)
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.db.deleteFrom("org_contact").where("id", "=", id).execute();
  }
}

function toOrgContact(row: {
  id: string;
  organization_id: string;
  label: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}): OrgContact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    label: row.label,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
