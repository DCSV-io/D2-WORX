import { eq, count } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CountSignInEventsByUserIdInput as I,
  CountSignInEventsByUserIdOutput as O,
  ICountSignInEventsByUserIdHandler,
} from "@d2/auth-app";
import { signInEvent } from "../../schema/custom-tables.js";

export class CountSignInEventsByUserId
  extends BaseHandler<I, O>
  implements ICountSignInEventsByUserIdHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const [result] = await this.db
      .select({ count: count() })
      .from(signInEvent)
      .where(eq(signInEvent.userId, input.userId));

    return D2Result.ok({ data: { count: result?.count ?? 0 }, traceId: this.traceId });
  }
}
