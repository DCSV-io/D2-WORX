import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { type DistributedCache, RateLimit } from "@d2/interfaces";
import { isLocalhost } from "@d2/request-enrichment";
import { DEFAULT_RATE_LIMIT_OPTIONS, type RateLimitOptions } from "../rate-limit-options.js";

type CheckInput = RateLimit.CheckInput;
type CheckOutput = RateLimit.CheckOutput;

/**
 * Handler for checking rate limits using sliding window approximation.
 * Mirrors D2.Shared.RateLimit.Default.Handlers.Check in .NET.
 *
 * Uses two fixed-window counters per dimension with a weighted average
 * to approximate a sliding window. Uses distributed cache handlers for
 * storage abstraction.
 *
 * Fail-open on all cache errors.
 */
export class Check
  extends BaseHandler<CheckInput, CheckOutput>
  implements RateLimit.ICheckHandler
{
  private readonly getTtl: DistributedCache.IGetTtlHandler;
  private readonly increment: DistributedCache.IIncrementHandler;
  private readonly set: DistributedCache.ISetHandler<string>;
  private readonly options: RateLimitOptions;

  constructor(
    getTtl: DistributedCache.IGetTtlHandler,
    increment: DistributedCache.IIncrementHandler,
    set: DistributedCache.ISetHandler<string>,
    options: Partial<RateLimitOptions>,
    context: IHandlerContext,
  ) {
    super(context);
    this.getTtl = getTtl;
    this.increment = increment;
    this.set = set;
    this.options = { ...DEFAULT_RATE_LIMIT_OPTIONS, ...options };
  }

  protected async executeAsync(input: CheckInput): Promise<D2Result<CheckOutput | undefined>> {
    const { requestInfo } = input;

    // Check dimensions in hierarchy order: fingerprint -> IP -> city -> country.
    // Short-circuit if any dimension is already blocked.

    // 1. Check client fingerprint (if present).
    if (requestInfo.clientFingerprint) {
      const result = await this.checkDimension(
        RateLimit.RateLimitDimension.ClientFingerprint,
        requestInfo.clientFingerprint,
        this.options.clientFingerprintThreshold,
      );
      if (result.isBlocked) {
        return D2Result.ok({ data: result, traceId: this.traceId });
      }
    }

    // 2. Check IP (if not localhost).
    if (!isLocalhost(requestInfo.clientIp)) {
      const result = await this.checkDimension(
        RateLimit.RateLimitDimension.Ip,
        requestInfo.clientIp,
        this.options.ipThreshold,
      );
      if (result.isBlocked) {
        return D2Result.ok({ data: result, traceId: this.traceId });
      }
    }

    // 3. Check city (if WhoIs resolved).
    if (requestInfo.city) {
      const result = await this.checkDimension(
        RateLimit.RateLimitDimension.City,
        requestInfo.city,
        this.options.cityThreshold,
      );
      if (result.isBlocked) {
        return D2Result.ok({ data: result, traceId: this.traceId });
      }
    }

    // 4. Check country (if WhoIs resolved and not whitelisted).
    if (
      requestInfo.countryCode &&
      !this.options.whitelistedCountryCodes.includes(requestInfo.countryCode)
    ) {
      const result = await this.checkDimension(
        RateLimit.RateLimitDimension.Country,
        requestInfo.countryCode,
        this.options.countryThreshold,
      );
      if (result.isBlocked) {
        return D2Result.ok({ data: result, traceId: this.traceId });
      }
    }

    // All dimensions passed.
    return D2Result.ok({
      data: { isBlocked: false, blockedDimension: undefined, retryAfterMs: undefined },
      traceId: this.traceId,
    });
  }

  /**
   * Gets the window ID for a given timestamp (minute-granularity UTC).
   */
  private static getWindowId(time: Date): string {
    const year = time.getUTCFullYear();
    const month = String(time.getUTCMonth() + 1).padStart(2, "0");
    const day = String(time.getUTCDate()).padStart(2, "0");
    const hours = String(time.getUTCHours()).padStart(2, "0");
    const minutes = String(time.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Checks a single dimension using sliding window approximation.
   */
  private async checkDimension(
    dimension: RateLimit.RateLimitDimension,
    value: string,
    threshold: number,
  ): Promise<CheckOutput> {
    const dimensionKey = dimension.toLowerCase();
    const blockedKey = `blocked:${dimensionKey}:${value}`;

    try {
      // 1. Check if already blocked.
      const ttlResult = await this.getTtl.handleAsync({ key: blockedKey });
      if (ttlResult.success && ttlResult.data?.timeToLiveMs !== undefined) {
        this.context.logger.debug(
          `Request blocked on ${dimension} dimension. Value: ${value}. TTL: ${ttlResult.data.timeToLiveMs}ms. TraceId: ${this.traceId}`,
        );
        return {
          isBlocked: true,
          blockedDimension: dimension,
          retryAfterMs: ttlResult.data.timeToLiveMs,
        };
      }

      // 2. Get current and previous window IDs.
      const now = new Date();
      const windowSeconds = this.options.windowMs / 1000;
      const currentWindowId = Check.getWindowId(now);
      const previousTime = new Date(now.getTime() - this.options.windowMs);
      const previousWindowId = Check.getWindowId(previousTime);

      const currentKey = `ratelimit:${dimensionKey}:${value}:${currentWindowId}`;
      const previousKey = `ratelimit:${dimensionKey}:${value}:${previousWindowId}`;
      const counterTtlMs = this.options.windowMs * 2;

      // 3. Get previous window count (increment by 0 to read current value).
      const prevResult = await this.increment.handleAsync({
        key: previousKey,
        amount: 0,
        expirationMs: counterTtlMs,
      });
      const prevCount = prevResult.success ? (prevResult.data?.newValue ?? 0) : 0;

      // 4. Increment current window and get new count.
      const incrResult = await this.increment.handleAsync({
        key: currentKey,
        amount: 1,
        expirationMs: counterTtlMs,
      });

      if (!incrResult.success) {
        // Fail-open on cache errors.
        this.context.logger.warn(
          `Failed to increment rate limit counter for ${dimension}:${value}. Failing open. TraceId: ${this.traceId}`,
        );
        return { isBlocked: false, blockedDimension: undefined, retryAfterMs: undefined };
      }

      const currCount = incrResult.data?.newValue ?? 0;

      // 5. Calculate weighted estimate.
      const secondsIntoCurrentWindow = now.getUTCSeconds() + now.getUTCMilliseconds() / 1000;
      const weight = 1.0 - secondsIntoCurrentWindow / windowSeconds;
      const estimated = Math.floor(prevCount * weight + currCount);

      // 6. Check if over threshold.
      if (estimated > threshold) {
        // Block the dimension.
        await this.set.handleAsync({
          key: blockedKey,
          value: "1",
          expirationMs: this.options.blockDurationMs,
        });

        this.context.logger.warn(
          `Rate limit exceeded on ${dimension} dimension. Value: ${value}. Count: ${estimated}/${threshold}. TraceId: ${this.traceId}`,
        );

        return {
          isBlocked: true,
          blockedDimension: dimension,
          retryAfterMs: this.options.blockDurationMs,
        };
      }

      return { isBlocked: false, blockedDimension: undefined, retryAfterMs: undefined };
    } catch {
      // Fail-open on cache errors.
      this.context.logger.warn(
        `Error checking rate limit for ${dimension}:${value}. Failing open. TraceId: ${this.traceId}`,
      );
      return { isBlocked: false, blockedDimension: undefined, retryAfterMs: undefined };
    }
  }
}
