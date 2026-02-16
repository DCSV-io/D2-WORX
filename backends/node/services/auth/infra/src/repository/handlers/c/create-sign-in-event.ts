import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CreateSignInEventInput as I,
  CreateSignInEventOutput as O,
  ICreateSignInEventHandler,
} from "@d2/auth-app";
import { signInEvent } from "../../schema/custom-tables.js";

export class CreateSignInEvent extends BaseHandler<I, O> implements ICreateSignInEventHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    await this.db.insert(signInEvent).values({
      id: input.event.id,
      userId: input.event.userId,
      successful: input.event.successful,
      ipAddress: input.event.ipAddress,
      userAgent: input.event.userAgent,
      whoIsId: input.event.whoIsId,
      createdAt: input.event.createdAt,
    });

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
