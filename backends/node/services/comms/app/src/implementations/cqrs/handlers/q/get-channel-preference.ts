import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ChannelPreference } from "@d2/comms-domain";
import type { ChannelPreferenceRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { InMemoryCache } from "@d2/interfaces";

export interface GetChannelPreferenceInput {
  readonly userId?: string;
  readonly contactId?: string;
}

export interface GetChannelPreferenceOutput {
  readonly pref: ChannelPreference | null;
}

export class GetChannelPreference extends BaseHandler<
  GetChannelPreferenceInput,
  GetChannelPreferenceOutput
> {
  private readonly repo: ChannelPreferenceRepoHandlers;
  private readonly cache?: {
    get: InMemoryCache.IGetHandler<ChannelPreference>;
    set: InMemoryCache.ISetHandler<ChannelPreference>;
  };

  constructor(
    repo: ChannelPreferenceRepoHandlers,
    context: IHandlerContext,
    cache?: {
      get: InMemoryCache.IGetHandler<ChannelPreference>;
      set: InMemoryCache.ISetHandler<ChannelPreference>;
    },
  ) {
    super(context);
    this.repo = repo;
    this.cache = cache;
  }

  protected async executeAsync(
    input: GetChannelPreferenceInput,
  ): Promise<D2Result<GetChannelPreferenceOutput | undefined>> {
    if (!input.userId && !input.contactId) {
      return D2Result.ok({ data: { pref: null } });
    }

    const cacheKey = input.userId
      ? `chan-pref:user:${input.userId}`
      : `chan-pref:contact:${input.contactId}`;

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get.handleAsync({ key: cacheKey });
      if (cached.success && cached.data?.value !== undefined) {
        return D2Result.ok({ data: { pref: cached.data.value } });
      }
    }

    // Fetch from DB
    let pref: ChannelPreference | null = null;
    if (input.userId) {
      const result = await this.repo.findByUserId.handleAsync({ userId: input.userId });
      if (result.success && result.data) pref = result.data.pref;
    } else if (input.contactId) {
      const result = await this.repo.findByContactId.handleAsync({ contactId: input.contactId });
      if (result.success && result.data) pref = result.data.pref;
    }

    // Populate cache on miss
    if (this.cache && pref) {
      await this.cache.set.handleAsync({ key: cacheKey, value: pref, expirationMs: 900_000 });
    }

    return D2Result.ok({ data: { pref } });
  }
}
