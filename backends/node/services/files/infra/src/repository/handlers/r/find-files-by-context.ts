import { and, eq, count, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { BaseHandler, type IHandlerContext, type RedactionSpec } from "@d2/handler";
import { D2Result } from "@d2/result";
import type {
  FindFilesByContextInput as I,
  FindFilesByContextOutput as O,
  IFindFilesByContextHandler,
} from "@d2/files-app";
import { file } from "../../schema/tables.js";
import { toFile } from "../../mappers/file-mapper.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export class FindFilesByContext extends BaseHandler<I, O> implements IFindFilesByContextHandler {
  private readonly db: NodePgDatabase;

  constructor(db: NodePgDatabase, context: IHandlerContext) {
    super(context);
    this.db = db;
  }

  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  protected async executeAsync(input: I): Promise<D2Result<O | undefined>> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = input.offset ?? 0;

    const where = and(
      eq(file.contextKey, input.contextKey),
      eq(file.relatedEntityId, input.relatedEntityId),
    );

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(file)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${file.createdAt} DESC`),
      this.db.select({ total: count() }).from(file).where(where),
    ]);

    return D2Result.ok({
      data: {
        files: rows.map(toFile),
        total: countResult[0]?.total ?? 0,
      },
    });
  }
}
