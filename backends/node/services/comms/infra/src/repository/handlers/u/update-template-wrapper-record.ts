import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateTemplateWrapperRecordInput as I,
  UpdateTemplateWrapperRecordOutput as O,
  IUpdateTemplateWrapperRecordHandler,
} from "@d2/comms-app";
import { templateWrapper } from "../../schema/tables.js";

export class UpdateTemplateWrapperRecord
  extends BaseHandler<I, O>
  implements IUpdateTemplateWrapperRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const t = input.template;
    await this.db
      .update(templateWrapper)
      .set({
        name: t.name,
        subjectTemplate: t.subjectTemplate,
        bodyTemplate: t.bodyTemplate,
        active: t.active,
        updatedAt: t.updatedAt,
      })
      .where(eq(templateWrapper.id, t.id));

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
