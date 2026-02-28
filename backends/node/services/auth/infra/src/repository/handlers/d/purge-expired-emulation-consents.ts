import { or, lt, isNotNull, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeExpiredEmulationConsentsInput as I,
  PurgeExpiredEmulationConsentsOutput as O,
  IPurgeExpiredEmulationConsentsHandler,
} from "@d2/auth-app";
import { emulationConsent } from "../../schema/custom-tables.js";

export class PurgeExpiredEmulationConsents
  extends BaseHandler<I, O>
  implements IPurgeExpiredEmulationConsentsHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(_input: I): Promise<D2Result<O | undefined>> {
    const now = new Date();

    // Delete consents that are expired OR already revoked.
    const totalDeleted = await batchDelete(
      (limit) =>
        this.db
          .select({ id: emulationConsent.id })
          .from(emulationConsent)
          .where(or(lt(emulationConsent.expiresAt, now), isNotNull(emulationConsent.revokedAt)))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        this.db
          .delete(emulationConsent)
          .where(inArray(emulationConsent.id, ids))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
