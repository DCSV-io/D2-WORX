import { lt, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeDeliveryHistoryInput as I,
  PurgeDeliveryHistoryOutput as O,
  IPurgeDeliveryHistoryHandler,
} from "@d2/comms-app";
import { deliveryRequest, deliveryAttempt } from "../../schema/tables.js";

export class PurgeDeliveryHistory
  extends BaseHandler<I, O>
  implements IPurgeDeliveryHistoryHandler
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
          .select({ id: deliveryRequest.id })
          .from(deliveryRequest)
          .where(lt(deliveryRequest.createdAt, input.cutoffDate))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        // Delete delivery attempts first (FK constraint), then requests.
        this.db
          .delete(deliveryAttempt)
          .where(inArray(deliveryAttempt.requestId, ids))
          .then(() => this.db.delete(deliveryRequest).where(inArray(deliveryRequest.id, ids)))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
