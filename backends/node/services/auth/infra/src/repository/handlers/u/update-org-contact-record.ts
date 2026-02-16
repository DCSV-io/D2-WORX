import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateOrgContactRecordInput as I,
  UpdateOrgContactRecordOutput as O,
  IUpdateOrgContactRecordHandler,
} from "@d2/auth-app";
import { orgContact } from "../../schema/custom-tables.js";

export class UpdateOrgContactRecord
  extends BaseHandler<I, O>
  implements IUpdateOrgContactRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    await this.db
      .update(orgContact)
      .set({
        label: input.contact.label,
        isPrimary: input.contact.isPrimary,
        updatedAt: input.contact.updatedAt,
      })
      .where(eq(orgContact.id, input.contact.id));

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
