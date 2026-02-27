import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateChannelPreferenceRecordInput as I,
  UpdateChannelPreferenceRecordOutput as O,
  IUpdateChannelPreferenceRecordHandler,
} from "@d2/comms-app";
import { channelPreference } from "../../schema/tables.js";

export class UpdateChannelPreferenceRecord
  extends BaseHandler<I, O>
  implements IUpdateChannelPreferenceRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const p = input.pref;
    const rows = await this.db
      .update(channelPreference)
      .set({
        emailEnabled: p.emailEnabled,
        smsEnabled: p.smsEnabled,
        updatedAt: p.updatedAt,
      })
      .where(eq(channelPreference.id, p.id))
      .returning({ id: channelPreference.id });

    if (rows.length === 0) return D2Result.notFound();

    return D2Result.ok({ data: {} });
  }
}
