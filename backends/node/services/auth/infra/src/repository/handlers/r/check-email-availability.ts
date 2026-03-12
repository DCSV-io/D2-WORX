import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CheckEmailAvailabilityInput as I,
  CheckEmailAvailabilityOutput as O,
  ICheckEmailAvailabilityHandler,
} from "@d2/auth-app";
import { user } from "../../schema/better-auth-tables.js";

export class CheckEmailAvailability
  extends BaseHandler<I, O>
  implements ICheckEmailAvailabilityHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  get redaction(): RedactionSpec {
    return { inputFields: ["email"] };
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);

    return D2Result.ok({ data: { available: rows.length === 0 } });
  }
}
