import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindMessageByIdInput as I,
  FindMessageByIdOutput as O,
  IFindMessageByIdHandler,
} from "@d2/comms-app";
import type { Message, ContentFormat, Urgency } from "@d2/comms-domain";
import { message } from "../../schema/tables.js";
import type { MessageRow } from "../../schema/types.js";

export class FindMessageById extends BaseHandler<I, O> implements IFindMessageByIdHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db.select().from(message).where(eq(message.id, input.id)).limit(1);

    const row = rows[0];
    if (!row) {
      return D2Result.notFound({
        messages: [`Message '${input.id}' not found.`],
        traceId: this.traceId,
      });
    }

    return D2Result.ok({ data: { message: toMessage(row) }, traceId: this.traceId });
  }
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.threadId,
    parentMessageId: row.parentMessageId,
    senderUserId: row.senderUserId,
    senderContactId: row.senderContactId,
    senderService: row.senderService,
    title: row.title,
    content: row.content,
    plainTextContent: row.plainTextContent,
    contentFormat: row.contentFormat as ContentFormat,
    sensitive: row.sensitive,
    urgency: row.urgency as Urgency,
    relatedEntityId: row.relatedEntityId,
    relatedEntityType: row.relatedEntityType,
    metadata: row.metadata as Record<string, unknown> | null,
    editedAt: row.editedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
