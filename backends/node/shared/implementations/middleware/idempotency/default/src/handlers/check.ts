import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache, Idempotency } from "@d2/interfaces";
import { z } from "zod";
import { DEFAULT_IDEMPOTENCY_OPTIONS, type IdempotencyOptions } from "../idempotency-options.js";

type CheckInput = Idempotency.CheckInput;
type CheckOutput = Idempotency.CheckOutput;

const SENTINEL = "__processing__";
const KEY_PREFIX = "idempotency:";

/**
 * Handler for checking idempotency state using SET NX + GET pattern.
 * Mirrors D2.Shared.Idempotency.Default.Handlers.X.Check in .NET.
 *
 * Complex handler (X/) because it may mutate shared state (creates Redis keys)
 * while its primary intent is retrieval of state.
 *
 * Fail-open on all cache errors.
 */
export class Check
  extends BaseHandler<CheckInput, CheckOutput>
  implements Idempotency.ICheckHandler
{
  private static readonly checkSchema = z.object({
    idempotencyKey: z.string().min(1).max(256),
  }) as unknown as z.ZodType<CheckInput>;

  private readonly setNx: DistributedCache.ISetNxHandler<string>;
  private readonly get: DistributedCache.IGetHandler<string>;
  private readonly options: IdempotencyOptions;

  constructor(
    setNx: DistributedCache.ISetNxHandler<string>,
    get: DistributedCache.IGetHandler<string>,
    options: Partial<IdempotencyOptions>,
    context: IHandlerContext,
  ) {
    super(context);
    this.setNx = setNx;
    this.get = get;
    this.options = { ...DEFAULT_IDEMPOTENCY_OPTIONS, ...options };
  }

  protected async executeAsync(input: CheckInput): Promise<D2Result<CheckOutput | undefined>> {
    // Validate input.
    const validation = this.validateInput(Check.checkSchema, input);
    if (validation.failed) {
      return D2Result.bubbleFail(validation);
    }

    const cacheKey = `${KEY_PREFIX}${input.idempotencyKey}`;

    try {
      // 1. Attempt to acquire the lock with SET NX.
      const setNxResult = await this.setNx.handleAsync({
        key: cacheKey,
        value: SENTINEL,
        expirationMs: this.options.inFlightTtlMs,
      });

      if (setNxResult.success && setNxResult.data?.wasSet === true) {
        // Lock acquired — caller should proceed with request processing.
        return D2Result.ok({
          data: { state: "acquired" as const, cachedResponse: undefined },
        });
      }

      // 2. Key exists — check if it's a sentinel or a cached response.
      const getResult = await this.get.handleAsync({ key: cacheKey });

      if (
        !getResult.success ||
        getResult.data?.value === undefined ||
        getResult.data.value === null
      ) {
        // GET failed or returned null — key may have expired between SET NX and GET.
        // Fail-open: treat as acquired.
        this.context.logger.warn(
          `Idempotency key exists but GET returned no value. Failing open. TraceId: ${this.traceId}`,
        );
        return D2Result.ok({
          data: { state: "acquired" as const, cachedResponse: undefined },
        });
      }

      // 3. Check if sentinel (in-flight) or cached response.
      if (getResult.data.value === SENTINEL) {
        return D2Result.ok({
          data: { state: "in_flight" as const, cachedResponse: undefined },
        });
      }

      // 4. Try to parse as CachedResponse.
      try {
        const cachedResponse = JSON.parse(getResult.data.value) as Idempotency.CachedResponse;
        if (cachedResponse && typeof cachedResponse.statusCode === "number") {
          return D2Result.ok({
            data: { state: "cached" as const, cachedResponse },
          });
        }
      } catch {
        this.context.logger.warn(
          `Failed to deserialize cached response for idempotency key. Failing open. TraceId: ${this.traceId}`,
        );
      }

      // Could not parse — fail-open: treat as acquired.
      return D2Result.ok({
        data: { state: "acquired" as const, cachedResponse: undefined },
      });
    } catch {
      // Fail-open on all cache errors.
      this.context.logger.warn(`Idempotency check failed. Failing open. TraceId: ${this.traceId}`);
      return D2Result.ok({
        data: { state: "acquired" as const, cachedResponse: undefined },
      });
    }
  }
}
