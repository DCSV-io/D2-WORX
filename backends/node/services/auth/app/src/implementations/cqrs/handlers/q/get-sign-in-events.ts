import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { SignInEvent } from "@d2/auth-domain";
import type { InMemoryCache } from "@d2/interfaces";
import type {
  IFindSignInEventsByUserIdHandler,
  ICountSignInEventsByUserIdHandler,
  IGetLatestSignInEventDateHandler,
} from "../../../../interfaces/repository/handlers/index.js";

export interface GetSignInEventsInput {
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetSignInEventsOutput {
  events: SignInEvent[];
  total: number;
}

/** Cache value shape for sign-in event queries. */
interface CachedEvents {
  events: SignInEvent[];
  total: number;
  latestDate: string | null;
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
export class GetSignInEvents extends BaseHandler<GetSignInEventsInput, GetSignInEventsOutput> {
  private readonly findByUserId: IFindSignInEventsByUserIdHandler;
  private readonly countByUserId: ICountSignInEventsByUserIdHandler;
  private readonly getLatestEventDate: IGetLatestSignInEventDateHandler;
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

  protected async executeAsync(
    input: GetSignInEventsInput,
  ): Promise<D2Result<GetSignInEventsOutput | undefined>> {
    const limit = Math.min(input.limit ?? 50, 100);
    const offset = Math.max(input.offset ?? 0, 0);

    // Try cache hit
    if (this.cache) {
      const cacheKey = `sign-in-events:${input.userId}:${limit}:${offset}`;
      const cacheResult = await this.cache.get.handleAsync({ key: cacheKey });

      if (cacheResult.success && cacheResult.data?.value) {
        const cached = cacheResult.data.value;

        // Verify staleness: check if latest event date still matches
        const dateResult = await this.getLatestEventDate.handleAsync({
          userId: input.userId,
        });
        const latestStr = dateResult.success
          ? (dateResult.data?.date?.toISOString() ?? null)
          : null;

        if (latestStr === cached.latestDate) {
          return D2Result.ok({
            data: { events: cached.events, total: cached.total },
          });
        }
      }
    }

    // Cache miss or stale — query DB
    const [findResult, countResult] = await Promise.all([
      this.findByUserId.handleAsync({ userId: input.userId, limit, offset }),
      this.countByUserId.handleAsync({ userId: input.userId }),
    ]);

    const events = findResult.success ? (findResult.data?.events ?? []) : [];
    const total = countResult.success ? (countResult.data?.count ?? 0) : 0;

    // Populate cache
    if (this.cache) {
      const firstEvent = events[0];
      const latestDate = firstEvent ? firstEvent.createdAt.toISOString() : null;
      const cacheKey = `sign-in-events:${input.userId}:${limit}:${offset}`;
      // Fire-and-forget — don't block response on cache write
      this.cache.set
        .handleAsync({
          key: cacheKey,
          value: { events, total, latestDate },
          expirationMs: CACHE_TTL_MS,
        })
        .catch(() => {});
    }

    return D2Result.ok({ data: { events, total } });
  }
}
