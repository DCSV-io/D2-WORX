import { lt, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeSignInEventsInput as I,
  PurgeSignInEventsOutput as O,
  IPurgeSignInEventsHandler,
} from "@d2/auth-app";
import { signInEvent } from "../../schema/custom-tables.js";

export class PurgeSignInEvents extends BaseHandler<I, O> implements IPurgeSignInEventsHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const totalDeleted = await batchDelete(
      (limit) =>
        this.db
          .select({ id: signInEvent.id })
          .from(signInEvent)
          .where(lt(signInEvent.createdAt, input.cutoffDate))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        this.db
          .delete(signInEvent)
          .where(inArray(signInEvent.id, ids))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
