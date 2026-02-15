import { eq, desc, isNull, gt, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { EmulationConsent } from "@d2/auth-domain";
import { emulationConsent } from "../schema/custom-tables.js";

/**
 * Drizzle-backed repository for emulation_consent records.
 */
export class EmulationConsentRepository {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase) {
    this.db = db;
  }

  async create(consent: EmulationConsent): Promise<void> {
    await this.db.insert(emulationConsent).values({
      id: consent.id,
      userId: consent.userId,
      grantedToOrgId: consent.grantedToOrgId,
      expiresAt: consent.expiresAt,
      revokedAt: consent.revokedAt,
      createdAt: consent.createdAt,
    });
  }

  async findById(id: string): Promise<EmulationConsent | undefined> {
    const [row] = await this.db
      .select()
      .from(emulationConsent)
      .where(eq(emulationConsent.id, id));

    return row ? toEmulationConsent(row) : undefined;
  }

  async findActiveByUserId(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<EmulationConsent[]> {
    const now = new Date();
    let query = this.db
      .select()
      .from(emulationConsent)
      .where(
        and(
          eq(emulationConsent.userId, userId),
          isNull(emulationConsent.revokedAt),
          gt(emulationConsent.expiresAt, now),
        ),
      )
      .orderBy(desc(emulationConsent.createdAt))
      .$dynamic();

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query;
    return rows.map(toEmulationConsent);
  }

  async findActiveByUserIdAndOrg(
    userId: string,
    grantedToOrgId: string,
  ): Promise<EmulationConsent | null> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(emulationConsent)
      .where(
        and(
          eq(emulationConsent.userId, userId),
          eq(emulationConsent.grantedToOrgId, grantedToOrgId),
          isNull(emulationConsent.revokedAt),
          gt(emulationConsent.expiresAt, now),
        ),
      );

    return row ? toEmulationConsent(row) : null;
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .update(emulationConsent)
      .set({ revokedAt: new Date() })
      .where(eq(emulationConsent.id, id));
  }
}

function toEmulationConsent(row: typeof emulationConsent.$inferSelect): EmulationConsent {
  return {
    id: row.id,
    userId: row.userId,
    grantedToOrgId: row.grantedToOrgId,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}
