import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CreateTemplateWrapperRecordInput as I,
  CreateTemplateWrapperRecordOutput as O,
  ICreateTemplateWrapperRecordHandler,
} from "@d2/comms-app";
import { templateWrapper } from "../../schema/tables.js";

export class CreateTemplateWrapperRecord
  extends BaseHandler<I, O>
  implements ICreateTemplateWrapperRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const t = input.template;
    await this.db.insert(templateWrapper).values({
      id: t.id,
      name: t.name,
      channel: t.channel,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      active: t.active,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
