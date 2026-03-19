import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import { isPgUniqueViolation } from "@d2/errors-pg";
import type {
  CreateFileRecordInput as I,
  CreateFileRecordOutput as O,
  ICreateFileRecordHandler,
} from "@d2/files-app";
import { file } from "../../schema/tables.js";

export class CreateFileRecord extends BaseHandler<I, O> implements ICreateFileRecordHandler {
  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const f = input.file;
    try {
      await this.db.insert(file).values({
        id: f.id,
        contextKey: f.contextKey,
        relatedEntityId: f.relatedEntityId,
        uploaderUserId: f.uploaderUserId,
        status: f.status,
        contentType: f.contentType,
        displayName: f.displayName,
        sizeBytes: f.sizeBytes,
        variants: f.variants ?? undefined,
        rejectionReason: f.rejectionReason ?? undefined,
        createdAt: f.createdAt,
      });

      return D2Result.ok({ data: { file: f } });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        return D2Result.conflict();
      }
      throw err;
    }
  }
}
