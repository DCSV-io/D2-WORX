import { and, inArray, isNotNull, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeDeletedMessagesInput as I,
  PurgeDeletedMessagesOutput as O,
  IPurgeDeletedMessagesHandler,
} from "@d2/comms-app";
import { message } from "../../schema/tables.js";

export class PurgeDeletedMessages
  extends BaseHandler<I, O>
  implements IPurgeDeletedMessagesHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const totalDeleted = await batchDelete(
      (limit) =>
        this.db
          .select({ id: message.id })
          .from(message)
          .where(and(isNotNull(message.deletedAt), lt(message.deletedAt, input.cutoffDate)))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        this.db
          .delete(message)
          .where(inArray(message.id, ids))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
