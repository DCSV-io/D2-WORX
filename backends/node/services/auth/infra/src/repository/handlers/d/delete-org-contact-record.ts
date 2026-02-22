import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  DeleteOrgContactRecordInput as I,
  DeleteOrgContactRecordOutput as O,
  IDeleteOrgContactRecordHandler,
} from "@d2/auth-app";
import { orgContact } from "../../schema/custom-tables.js";

export class DeleteOrgContactRecord
  extends BaseHandler<I, O>
  implements IDeleteOrgContactRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    await this.db.delete(orgContact).where(eq(orgContact.id, input.id));

    return D2Result.ok({ data: {} });
  }
}
