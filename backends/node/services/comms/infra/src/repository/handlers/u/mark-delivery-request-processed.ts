import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  MarkDeliveryRequestProcessedInput as I,
  MarkDeliveryRequestProcessedOutput as O,
  IMarkDeliveryRequestProcessedHandler,
} from "@d2/comms-app";
import { deliveryRequest } from "../../schema/tables.js";

export class MarkDeliveryRequestProcessed
  extends BaseHandler<I, O>
  implements IMarkDeliveryRequestProcessedHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    await this.db
      .update(deliveryRequest)
      .set({ processedAt: new Date() })
      .where(eq(deliveryRequest.id, input.id));

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
