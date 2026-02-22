import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  CreateChannelPreferenceRecordInput as I,
  CreateChannelPreferenceRecordOutput as O,
  ICreateChannelPreferenceRecordHandler,
} from "@d2/comms-app";
import { channelPreference } from "../../schema/tables.js";

export class CreateChannelPreferenceRecord
  extends BaseHandler<I, O>
  implements ICreateChannelPreferenceRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const p = input.pref;
    await this.db.insert(channelPreference).values({
      id: p.id,
      userId: p.userId,
      contactId: p.contactId,
      emailEnabled: p.emailEnabled,
      smsEnabled: p.smsEnabled,
      quietHoursStart: p.quietHoursStart,
      quietHoursEnd: p.quietHoursEnd,
      quietHoursTz: p.quietHoursTz,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });

    return D2Result.ok({ data: {} });
  }
}
