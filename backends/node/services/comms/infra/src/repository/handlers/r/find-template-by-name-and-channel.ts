import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindTemplateByNameAndChannelInput as I,
  FindTemplateByNameAndChannelOutput as O,
  IFindTemplateByNameAndChannelHandler,
} from "@d2/comms-app";
import type { TemplateWrapper, Channel } from "@d2/comms-domain";
import { templateWrapper } from "../../schema/tables.js";
import type { TemplateWrapperRow } from "../../schema/types.js";

export class FindTemplateByNameAndChannel
  extends BaseHandler<I, O>
  implements IFindTemplateByNameAndChannelHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db
      .select()
      .from(templateWrapper)
      .where(
        and(eq(templateWrapper.name, input.name), eq(templateWrapper.channel, input.channel)),
      )
      .limit(1);

    const row = rows[0];
    return D2Result.ok({
      data: { template: row ? toTemplateWrapper(row) : null },
      traceId: this.traceId,
    });
  }
}

export function toTemplateWrapper(row: TemplateWrapperRow): TemplateWrapper {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel as Channel,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
