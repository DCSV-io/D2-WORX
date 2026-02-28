import { lt, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { batchDelete, DEFAULT_BATCH_SIZE } from "@d2/batch-pg";
import type {
  PurgeExpiredInvitationsInput as I,
  PurgeExpiredInvitationsOutput as O,
  IPurgeExpiredInvitationsHandler,
} from "@d2/auth-app";
import { invitation } from "../../schema/better-auth-tables.js";

export class PurgeExpiredInvitations
  extends BaseHandler<I, O>
  implements IPurgeExpiredInvitationsHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const totalDeleted = await batchDelete(
      (limit) =>
        this.db
          .select({ id: invitation.id })
          .from(invitation)
          .where(lt(invitation.expiresAt, input.cutoffDate))
          .limit(limit)
          .then((rows) => rows.map((r) => r.id)),
      (ids) =>
        this.db
          .delete(invitation)
          .where(inArray(invitation.id, ids))
          .then(() => {}),
      DEFAULT_BATCH_SIZE,
    );

    return D2Result.ok({ data: { rowsAffected: totalDeleted } });
  }
}
