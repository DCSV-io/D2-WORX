import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CreateDeliveryRequestRecordInput as I,
  CreateDeliveryRequestRecordOutput as O,
  ICreateDeliveryRequestRecordHandler,
} from "@d2/comms-app";
import { deliveryRequest } from "../../schema/tables.js";

export class CreateDeliveryRequestRecord
  extends BaseHandler<I, O>
  implements ICreateDeliveryRequestRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const r = input.request;
    await this.db.insert(deliveryRequest).values({
      id: r.id,
      messageId: r.messageId,
      correlationId: r.correlationId,
      recipientContactId: r.recipientContactId,
      callbackTopic: r.callbackTopic,
      createdAt: r.createdAt,
      processedAt: r.processedAt,
    });

    return D2Result.ok({ data: {} });
  }
}
