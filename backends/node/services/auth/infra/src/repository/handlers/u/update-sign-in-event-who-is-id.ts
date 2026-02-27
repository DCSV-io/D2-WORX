import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateSignInEventWhoIsIdInput as I,
  UpdateSignInEventWhoIsIdOutput as O,
  IUpdateSignInEventWhoIsIdHandler,
} from "@d2/auth-app";
import { signInEvent } from "../../schema/custom-tables.js";

export class UpdateSignInEventWhoIsId
  extends BaseHandler<I, O>
  implements IUpdateSignInEventWhoIsIdHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db
      .update(signInEvent)
      .set({ whoIsId: input.whoIsId })
      .where(eq(signInEvent.id, input.id))
      .returning({ id: signInEvent.id });

    if (rows.length === 0) return D2Result.notFound();

    return D2Result.ok({ data: {} });
  }
}
