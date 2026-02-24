import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";

type Input = DistributedCache.PingInput;
type Output = DistributedCache.PingOutput;

export class PingCache extends BaseHandler<Input, Output> implements DistributedCache.IPingHandler {
  private readonly redis: Redis;

  constructor(redis: Redis, context: IHandlerContext) {
    super(context);
    this.redis = redis;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const start = performance.now();
    try {
      await this.redis.ping();
      const latencyMs = Math.round(performance.now() - start);
      return D2Result.ok({ data: { healthy: true, latencyMs } });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : "Unknown error";
      return D2Result.ok({ data: { healthy: false, latencyMs, error } });
    }
  }
}
