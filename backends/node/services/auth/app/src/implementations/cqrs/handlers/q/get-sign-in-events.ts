import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SignInEvent } from "@d2/auth-domain";
import type { InMemoryCache } from "@d2/interfaces";
import { AUTH_CACHE_KEYS } from "../../../../cache-keys.js";
import type {
  IFindSignInEventsByUserIdHandler,
  ICountSignInEventsByUserIdHandler,
  IGetLatestSignInEventDateHandler,
} from "../../../../interfaces/repository/handlers/index.js";
import { Queries } from "../../../../interfaces/cqrs/handlers/index.js";

type Input = Queries.GetSignInEventsInput;
type Output = Queries.GetSignInEventsOutput;

/** Cache value shape for sign-in event queries. */
interface CachedEvents {
  events: SignInEvent[];
  total: number;
  latestDate?: string;
}

/** Cache TTL: 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Retrieves paginated sign-in events for a user.
 *
 * Uses local memory cache with staleness check: if the latest event date
 * for the user hasn't changed since the cache was populated, the cached
 * result is still valid (sign-in events are append-only, so older pages
 * are stable as long as no new events exist).
 */
export class GetSignInEvents
  extends BaseHandler<Input, Output>
  implements Queries.IGetSignInEventsHandler
{
  private readonly findByUserId: IFindSignInEventsByUserIdHandler;
  private readonly countByUserId: ICountSignInEventsByUserIdHandler;
  private readonly getLatestEventDate: IGetLatestSignInEventDateHandler;

  override get redaction() {
    return Queries.GET_SIGN_IN_EVENTS_REDACTION;
  }
  private readonly cache?: {
    get: InMemoryCache.IGetHandler<CachedEvents>;
    set: InMemoryCache.ISetHandler<CachedEvents>;
  };

  constructor(
    findByUserId: IFindSignInEventsByUserIdHandler,
    countByUserId: ICountSignInEventsByUserIdHandler,
    getLatestEventDate: IGetLatestSignInEventDateHandler,
    context: IHandlerContext,
    cache?: {
      get: InMemoryCache.IGetHandler<CachedEvents>;
      set: InMemoryCache.ISetHandler<CachedEvents>;
    },
  ) {
    super(context);
    this.findByUserId = findByUserId;
    this.countByUserId = countByUserId;
    this.getLatestEventDate = getLatestEventDate;
    this.cache = cache;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const limit = Math.min(input.limit ?? 50, 100);
    const offset = Math.max(input.offset ?? 0, 0);

    // Try cache hit
    if (this.cache) {
      const cacheKey = AUTH_CACHE_KEYS.signInEvents(input.userId, limit, offset);
      const cacheResult = await this.cache.get.handleAsync({ key: cacheKey });

      if (cacheResult.success && cacheResult.data?.value) {
        const cached = cacheResult.data.value;

        // Verify staleness: check if latest event date still matches
        const dateResult = await this.getLatestEventDate.handleAsync({
          userId: input.userId,
        });
        const latestStr = dateResult.success ? dateResult.data?.date?.toISOString() : undefined;

        if (latestStr === cached.latestDate) {
          return D2Result.ok({
            data: { events: cached.events, total: cached.total },
          });
        }
      }
    }

    // Cache miss or stale — query DB
    const [findResult, countResult, latestDateResult] = await Promise.all([
      this.findByUserId.handleAsync({ userId: input.userId, limit, offset }),
      this.countByUserId.handleAsync({ userId: input.userId }),
      this.getLatestEventDate.handleAsync({ userId: input.userId }),
    ]);

    if (!findResult.success) return D2Result.bubbleFail(findResult);
    if (!countResult.success) return D2Result.bubbleFail(countResult);
    const events = findResult.data?.events ?? [];
    const total = countResult.data?.count ?? 0;

    // Populate cache with the globally most-recent event date (not the page's first event).
    // This ensures the staleness check works for ALL pages, including those with offset > 0.
    if (this.cache) {
      const globalLatestDate = latestDateResult.success
        ? latestDateResult.data?.date?.toISOString()
        : undefined;
      const cacheKey = AUTH_CACHE_KEYS.signInEvents(input.userId, limit, offset);
      // Fire-and-forget — don't block response on cache write
      this.cache.set
        .handleAsync({
          key: cacheKey,
          value: { events, total, latestDate: globalLatestDate },
          expirationMs: CACHE_TTL_MS,
        })
        .catch((err: unknown) =>
          this.context.logger.debug("GetSignInEvents: cache set failed", {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    return D2Result.ok({ data: { events, total } });
  }
}

export type {
  GetSignInEventsInput,
  GetSignInEventsOutput,
} from "../../../../interfaces/cqrs/handlers/q/get-sign-in-events.js";
