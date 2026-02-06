import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";

type Input = DistributedCache.ExistsInput;
type Output = DistributedCache.ExistsOutput;

export class Exists extends BaseHandler<Input, Output> {
  private readonly redis: Redis;

  constructor(redis: Redis, context: IHandlerContext) {
    super(context);
    this.redis = redis;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    try {
      const count = await this.redis.exists(input.key);
      return D2Result.ok({ data: { exists: count > 0 }, traceId: this.traceId });
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
