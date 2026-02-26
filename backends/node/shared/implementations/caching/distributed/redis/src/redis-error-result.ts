import { D2Result, ErrorCodes, HttpStatusCode } from "@d2/result";

/**
 * Returns a standard D2Result failure for Redis connection/operation errors.
 * Used by all Redis cache handlers as a catch-all for infrastructure failures.
 */
export function redisErrorResult<T>(): D2Result<T> {
  return D2Result.fail<T>({
    messages: ["Unable to connect to Redis."],
    statusCode: HttpStatusCode.ServiceUnavailable,
    errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
  });
}
