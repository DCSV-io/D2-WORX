import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { redisErrorResult } from "../../redis-error-result.js";
import type { DistributedCache } from "@d2/interfaces";

type Input = DistributedCache.IncrementInput;
type Output = DistributedCache.IncrementOutput;

/** Lua script for atomic INCRBY + conditional PEXPIRE. */
const _INCREMENT_SCRIPT = `
local result = redis.call('INCRBY', KEYS[1], ARGV[1])
if tonumber(ARGV[2]) > 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return result
`;

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
      const amount = input.amount ?? 1;
      const expirationMs = input.expirationMs ?? 0;

      // Atomic INCRBY + PEXPIRE via Lua to prevent race conditions where the
      // key could exist without an expiration if PEXPIRE fails independently.
      const newValue = (await this.redis.eval(
        _INCREMENT_SCRIPT,
        1,
        input.key,
        amount,
        expirationMs,
      )) as number;

      return D2Result.ok({ data: { newValue } });
    } catch (err: unknown) {
      return redisErrorResult(err);
    }
  }
}
