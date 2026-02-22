import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { SIGN_IN_THROTTLE, computeSignInDelay } from "@d2/auth-domain";
import type { InMemoryCache } from "@d2/interfaces";
import type { ISignInThrottleStore } from "../../../../interfaces/repository/sign-in-throttle-store.js";

export interface RecordSignInOutcomeInput {
  readonly identifierHash: string;
  readonly identityHash: string;
  readonly responseStatus: number;
}

export interface RecordSignInOutcomeOutput {
  readonly recorded: boolean;
}

/**
 * Records the outcome of a sign-in attempt for brute-force throttling.
 *
 * - **Success (200):** marks identity as known-good, clears failure state,
 *   updates local cache.
 * - **Failure (401/400):** increments failure counter, computes delay,
 *   sets lockout if threshold exceeded.
 * - **Other status:** no-op.
 *
 * **Fail-open:** All store errors are swallowed — returns `{ recorded: false }`.
 */
export class RecordSignInOutcome extends BaseHandler<
  RecordSignInOutcomeInput,
  RecordSignInOutcomeOutput
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
    input: RecordSignInOutcomeInput,
  ): Promise<D2Result<RecordSignInOutcomeOutput | undefined>> {
    try {
      if (input.responseStatus === 200) {
        return await this.handleSuccess(input);
      }

      if (input.responseStatus === 401 || input.responseStatus === 400) {
        return await this.handleFailure(input);
      }

      // Other status codes (e.g. 500) — no-op
      return D2Result.ok({ data: { recorded: false } });
    } catch {
      // Fail-open: swallow all store errors
      return D2Result.ok({ data: { recorded: false } });
    }
  }

  private async handleSuccess(
    input: RecordSignInOutcomeInput,
  ): Promise<D2Result<RecordSignInOutcomeOutput | undefined>> {
    await Promise.all([
      this.store.markKnownGood(input.identifierHash, input.identityHash),
      this.store.clearFailureState(input.identifierHash, input.identityHash),
    ]);

    // Update local cache
    if (this.cache) {
      const cacheKey = `${input.identifierHash}:${input.identityHash}`;
      this.cache.set
        .handleAsync({
          key: cacheKey,
          value: true,
          expirationMs: SIGN_IN_THROTTLE.KNOWN_GOOD_CACHE_TTL_MS,
        })
        .catch(() => {});
    }

    return D2Result.ok({ data: { recorded: true } });
  }

  private async handleFailure(
    input: RecordSignInOutcomeInput,
  ): Promise<D2Result<RecordSignInOutcomeOutput | undefined>> {
    const count = await this.store.incrementFailures(input.identifierHash, input.identityHash);
    const delayMs = computeSignInDelay(count);

    if (delayMs > 0) {
      const delaySec = Math.ceil(delayMs / 1000);
      await this.store.setLocked(input.identifierHash, input.identityHash, delaySec);
    }

    return D2Result.ok({ data: { recorded: true } });
  }
}
