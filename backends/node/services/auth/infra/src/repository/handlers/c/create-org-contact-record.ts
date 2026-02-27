import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import type {
  CreateOrgContactRecordInput as I,
  CreateOrgContactRecordOutput as O,
  ICreateOrgContactRecordHandler,
} from "@d2/auth-app";
import { orgContact } from "../../schema/custom-tables.js";
import { isPgUniqueViolation } from "@d2/repository-pg";

export class CreateOrgContactRecord
  extends BaseHandler<I, O>
  implements ICreateOrgContactRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    try {
      await this.db.insert(orgContact).values({
        id: input.contact.id,
        organizationId: input.contact.organizationId,
        label: input.contact.label,
        isPrimary: input.contact.isPrimary,
        createdAt: input.contact.createdAt,
        updatedAt: input.contact.updatedAt,
      });

      return D2Result.ok({ data: {} });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        return D2Result.fail({
          messages: ["Record already exists."],
          statusCode: HttpStatusCode.Conflict,
          errorCode: ErrorCodes.CONFLICT,
        });
      }
      throw err;
    }
  }
}
