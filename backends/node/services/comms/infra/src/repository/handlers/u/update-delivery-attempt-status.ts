import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateDeliveryAttemptStatusInput as I,
  UpdateDeliveryAttemptStatusOutput as O,
  IUpdateDeliveryAttemptStatusHandler,
} from "@d2/comms-app";
import { deliveryAttempt } from "../../schema/tables.js";

export class UpdateDeliveryAttemptStatus
  extends BaseHandler<I, O>
  implements IUpdateDeliveryAttemptStatusHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const updates: Record<string, unknown> = { status: input.status };
    if (input.providerMessageId !== undefined) updates.providerMessageId = input.providerMessageId;
    if (input.error !== undefined) updates.error = input.error;
    if (input.nextRetryAt !== undefined) updates.nextRetryAt = input.nextRetryAt;

    await this.db.update(deliveryAttempt).set(updates).where(eq(deliveryAttempt.id, input.id));

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
