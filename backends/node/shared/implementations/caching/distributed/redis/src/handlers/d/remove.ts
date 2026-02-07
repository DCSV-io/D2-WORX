import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";

type Input = DistributedCache.RemoveInput;
type Output = DistributedCache.RemoveOutput;

export class Remove extends BaseHandler<Input, Output> implements DistributedCache.IRemoveHandler {
  private readonly redis: Redis;

  constructor(redis: Redis, context: IHandlerContext) {
    super(context);
    this.redis = redis;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    try {
      await this.redis.del(input.key);
      return D2Result.ok({ data: {}, traceId: this.traceId });
    } catch {
      return D2Result.fail({
        messages: ["Unable to connect to Redis."],
        statusCode: HttpStatusCode.ServiceUnavailable,
        errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
        traceId: this.traceId,
      });
    }
  }
}
