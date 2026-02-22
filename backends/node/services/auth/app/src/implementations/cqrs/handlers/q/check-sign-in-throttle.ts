import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { SIGN_IN_THROTTLE } from "@d2/auth-domain";
import type { InMemoryCache } from "@d2/interfaces";
import type { ISignInThrottleStore } from "../../../../interfaces/repository/sign-in-throttle-store.js";

export interface CheckSignInThrottleInput {
  readonly identifierHash: string;
  readonly identityHash: string;
}

export interface CheckSignInThrottleOutput {
  readonly blocked: boolean;
  readonly retryAfterSec?: number;
}

/**
 * Checks whether a sign-in attempt should be throttled.
 *
 * Optimized for minimal Redis round-trips:
 * - Known device (local cache hit): **0 Redis calls**
 * - Known device (cache miss): 1 concurrent round-trip (2 pipelined commands)
 * - Unknown device, not locked: 1 round-trip
 * - Unknown device, locked: 1 round-trip
 *
 * **Fail-open:** Any store error → `{ blocked: false }`.
 */
export class CheckSignInThrottle extends BaseHandler<
  CheckSignInThrottleInput,
  CheckSignInThrottleOutput
> {
  private readonly store: ISignInThrottleStore;
  private readonly cache?: {
    get: InMemoryCache.IGetHandler<boolean>;
    set: InMemoryCache.ISetHandler<boolean>;
  };

  constructor(
    store: ISignInThrottleStore,
    context: IHandlerContext,
    cache?: {
      get: InMemoryCache.IGetHandler<boolean>;
      set: InMemoryCache.ISetHandler<boolean>;
    },
  ) {
    super(context);
    this.store = store;
    this.cache = cache;
  }

  protected async executeAsync(
    input: CheckSignInThrottleInput,
  ): Promise<D2Result<CheckSignInThrottleOutput | undefined>> {
    try {
      const cacheKey = `${input.identifierHash}:${input.identityHash}`;

      // 1. Check local memory cache for known-good → fast path (0 Redis calls)
      if (this.cache) {
        const cacheResult = await this.cache.get.handleAsync({ key: cacheKey });
        if (cacheResult.success && cacheResult.data?.value === true) {
          return D2Result.ok({ data: { blocked: false } });
        }
      }

      // 2. Cache miss → concurrent Redis lookups (1 round-trip, 2 pipelined commands)
      const [knownGood, lockedTtlSec] = await Promise.all([
        this.store.isKnownGood(input.identifierHash, input.identityHash),
        this.store.getLockedTtlSeconds(input.identifierHash, input.identityHash),
      ]);

      // 3. Known-good → populate memory cache, return unblocked
      if (knownGood) {
        if (this.cache) {
          this.cache.set
            .handleAsync({
              key: cacheKey,
              value: true,
              expirationMs: SIGN_IN_THROTTLE.KNOWN_GOOD_CACHE_TTL_MS,
            })
            .catch(() => {});
        }
        return D2Result.ok({ data: { blocked: false } });
      }

      // 4. Locked → return blocked with retry-after
      if (lockedTtlSec > 0) {
        return D2Result.ok({
          data: { blocked: true, retryAfterSec: Math.ceil(lockedTtlSec) },
        });
      }

      // 5. Not known-good, not locked → allow
      return D2Result.ok({ data: { blocked: false } });
    } catch {
      // Fail-open: any error → allow the sign-in attempt
      return D2Result.ok({ data: { blocked: false } });
    }
  }
}
