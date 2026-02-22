import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  RevokeEmulationConsentRecordInput as I,
  RevokeEmulationConsentRecordOutput as O,
  IRevokeEmulationConsentRecordHandler,
} from "@d2/auth-app";
import { emulationConsent } from "../../schema/custom-tables.js";

export class RevokeEmulationConsentRecord
  extends BaseHandler<I, O>
  implements IRevokeEmulationConsentRecordHandler
{
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    await this.db
      .update(emulationConsent)
      .set({ revokedAt: new Date() })
      .where(eq(emulationConsent.id, input.id));

    return D2Result.ok({ data: {} });
  }
}
