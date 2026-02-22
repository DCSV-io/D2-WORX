import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindChannelPreferenceByUserIdInput as I,
  FindChannelPreferenceByUserIdOutput as O,
  IFindChannelPreferenceByUserIdHandler,
} from "@d2/comms-app";
import { channelPreference } from "../../schema/tables.js";
import { toChannelPreference } from "./find-channel-preference-by-contact-id.js";

export class FindChannelPreferenceByUserId
  extends BaseHandler<I, O>
  implements IFindChannelPreferenceByUserIdHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db
      .select()
      .from(channelPreference)
      .where(eq(channelPreference.userId, input.userId))
      .limit(1);

    const row = rows[0];
    return D2Result.ok({
      data: { pref: row ? toChannelPreference(row) : null },
    });
  }
}
