import type { Kysely } from "kysely";
import type { EmulationConsent } from "@d2/auth-domain";
import type { AuthCustomDatabase, NewEmulationConsent } from "../entities/kysely-types.js";

/**
 * Kysely-based repository for emulation_consent records.
 */
export class EmulationConsentRepository {
  private readonly db: Kysely<AuthCustomDatabase>;

  constructor(db: Kysely<AuthCustomDatabase>) {
    this.db = db;
  }

  async create(consent: EmulationConsent): Promise<void> {
    const row: NewEmulationConsent = {
      id: consent.id,
      user_id: consent.userId,
      granted_to_org_id: consent.grantedToOrgId,
      expires_at: consent.expiresAt,
      revoked_at: consent.revokedAt,
      created_at: consent.createdAt,
    };

    await this.db.insertInto("emulation_consent").values(row).execute();
  }

  async findById(id: string): Promise<EmulationConsent | undefined> {
    const row = await this.db
      .selectFrom("emulation_consent")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? toEmulationConsent(row) : undefined;
  }

  async findActiveByUserId(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<EmulationConsent[]> {
    const now = new Date();
    let query = this.db
      .selectFrom("emulation_consent")
      .selectAll()
      .where("user_id", "=", userId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", now)
      .orderBy("created_at", "desc");

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query.execute();
    return rows.map(toEmulationConsent);
  }

  async findActiveByUserIdAndOrg(
    userId: string,
    grantedToOrgId: string,
  ): Promise<EmulationConsent | null> {
    const now = new Date();
    const row = await this.db
      .selectFrom("emulation_consent")
      .selectAll()
      .where("user_id", "=", userId)
      .where("granted_to_org_id", "=", grantedToOrgId)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", now)
      .executeTakeFirst();

    return row ? toEmulationConsent(row) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .updateTable("emulation_consent")
      .set({ revoked_at: new Date() })
      .where("id", "=", id)
      .execute();
  }
}

function toEmulationConsent(row: {
  id: string;
  user_id: string;
  granted_to_org_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}): EmulationConsent {
  return {
    id: row.id,
    userId: row.user_id,
    grantedToOrgId: row.granted_to_org_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}
