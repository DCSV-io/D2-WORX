import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { redisErrorResult } from "../../redis-error-result.js";
import type { DistributedCache } from "@d2/interfaces";

type Input = DistributedCache.IncrementInput;
type Output = DistributedCache.IncrementOutput;

export class Increment
  extends BaseHandler<Input, Output>
  implements DistributedCache.IIncrementHandler
{
  private readonly redis: Redis;

  constructor(redis: Redis, context: IHandlerContext) {
    super(context);
    this.redis = redis;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    try {
      const newValue = await this.redis.incrby(input.key, input.amount ?? 1);

      if (input.expirationMs !== undefined) {
        await this.redis.pexpire(input.key, input.expirationMs);
      }

      return D2Result.ok({ data: { newValue } });
    } catch {
      return redisErrorResult();
    }
  }
}
