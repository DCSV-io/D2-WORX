import { and, eq, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindStaleFilesInput as I,
  FindStaleFilesOutput as O,
  IFindStaleFilesHandler,
} from "@d2/files-app";
import { file } from "../../schema/tables.js";
import { toFile } from "../../mappers/file-mapper.js";

export class FindStaleFiles extends BaseHandler<I, O> implements IFindStaleFilesHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const rows = await this.db
      .select()
      .from(file)
      .where(and(eq(file.status, input.status), lte(file.createdAt, input.cutoffDate)))
      .limit(input.limit);

    return D2Result.ok({ data: { files: rows.map(toFile) } });
  }
}
