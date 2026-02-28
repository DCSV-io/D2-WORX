import { lt, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeExpiredSessionsInput as I,
  PurgeExpiredSessionsOutput as O,
  IPurgeExpiredSessionsHandler,
} from "@d2/auth-app";
import { session } from "../../schema/better-auth-tables.js";

export class PurgeExpiredSessions
  extends BaseHandler<I, O>
  implements IPurgeExpiredSessionsHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(_input: I): Promise<D2Result<O | undefined>> {
    const now = new Date();

    const totalDeleted = await batchDelete(
      (limit) =>
        this.db
          .select({ id: session.id })
          .from(session)
          .where(lt(session.expiresAt, now))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        this.db
          .delete(session)
          .where(inArray(session.id, ids))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
