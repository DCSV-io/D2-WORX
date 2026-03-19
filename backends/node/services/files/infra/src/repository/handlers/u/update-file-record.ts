import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  UpdateFileRecordInput as I,
  UpdateFileRecordOutput as O,
  IUpdateFileRecordHandler,
} from "@d2/files-app";
import { file } from "../../schema/tables.js";
import { toFile } from "../../mappers/file-mapper.js";

export class UpdateFileRecord extends BaseHandler<I, O> implements IUpdateFileRecordHandler {
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
    const rows = await this.db
      .update(file)
      .set({
        status: f.status,
        contentType: f.contentType,
        displayName: f.displayName,
        sizeBytes: f.sizeBytes,
        variants: f.variants ?? undefined,
        rejectionReason: f.rejectionReason ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(file.id, f.id))
      .returning();

    const row = rows[0];
    if (!row) {
      return D2Result.notFound();
    }

    return D2Result.ok({ data: { file: toFile(row) } });
  }
}
