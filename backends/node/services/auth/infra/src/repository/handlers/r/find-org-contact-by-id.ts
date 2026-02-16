import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { OrgContact } from "@d2/auth-domain";
import type {
  FindOrgContactByIdInput as I,
  FindOrgContactByIdOutput as O,
  IFindOrgContactByIdHandler,
} from "@d2/auth-app";
import { orgContact } from "../../schema/custom-tables.js";

export class FindOrgContactById
  extends BaseHandler<I, O>
  implements IFindOrgContactByIdHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const [row] = await this.db
      .select()
      .from(orgContact)
      .where(eq(orgContact.id, input.id));

    if (!row) {
      return D2Result.notFound({ traceId: this.traceId });
    }

    return D2Result.ok({ data: { contact: toOrgContact(row) }, traceId: this.traceId });
  }
}

function toOrgContact(row: typeof orgContact.$inferSelect): OrgContact {
  return {
    id: row.id,
    organizationId: row.organizationId,
    label: row.label,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
