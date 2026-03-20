import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindFileByIdInput as I,
  FindFileByIdOutput as O,
  IFindFileByIdHandler,
} from "@d2/files-app";
import { file } from "../../schema/tables.js";
import { toFile } from "../../mappers/file-mapper.js";

export class FindFileById extends BaseHandler<I, O> implements IFindFileByIdHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db.select().from(file).where(eq(file.id, input.id)).limit(1);

    const row = rows[0];
    if (!row) {
      return D2Result.notFound();
    }

    return D2Result.ok({ data: { file: toFile(row) } });
  }
}
