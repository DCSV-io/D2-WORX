import type Redis from "ioredis";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";
import type { DistributedCache } from "@d2/interfaces";
import { JsonCacheSerializer, type ICacheSerializer } from "../../serialization.js";

export class Set<TValue>
  extends BaseHandler<DistributedCache.SetInput<TValue>, DistributedCache.SetOutput>
  implements DistributedCache.ISetHandler<TValue>
{
  private readonly redis: Redis;
  private readonly serializer: ICacheSerializer<TValue>;

  constructor(redis: Redis, context: IHandlerContext, serializer?: ICacheSerializer<TValue>) {
    super(context);
    this.redis = redis;
    this.serializer = serializer ?? new JsonCacheSerializer<TValue>();
  }

  protected async executeAsync(
    input: DistributedCache.SetInput<TValue>,
  ): Promise<D2Result<DistributedCache.SetOutput | undefined>> {
    try {
      let serialized: string | Buffer;
      try {
        serialized = this.serializer.serialize(input.value);
      } catch {
        return D2Result.fail({
          messages: ["Value could not be serialized."],
          statusCode: HttpStatusCode.InternalServerError,
          errorCode: ErrorCodes.COULD_NOT_BE_SERIALIZED,
          traceId: this.traceId,
        });
      }

      if (input.expirationMs !== undefined) {
        await this.redis.set(input.key, serialized, "PX", input.expirationMs);
      } else {
        await this.redis.set(input.key, serialized);
      }

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
