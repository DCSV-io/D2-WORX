import type pg from "pg";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { PingDbInput as I, PingDbOutput as O, IPingDbHandler } from "@d2/auth-app";

export class PingDb extends BaseHandler<I, O> implements IPingDbHandler {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool, context: IHandlerContext) {
    super(context);
    this.pool = pool;
  }

  protected async executeAsync(_input: I): Promise<D2Result<O | undefined>> {
    const start = performance.now();
    try {
      await this.pool.query("SELECT 1");
      const latencyMs = Math.round(performance.now() - start);
      return D2Result.ok({ data: { healthy: true, latencyMs } });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : "Unknown error";
      return D2Result.ok({ data: { healthy: false, latencyMs, error } });
    }
  }
}
