import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ChannelPreference } from "@d2/comms-domain";
import type { ChannelPreferenceRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { InMemoryCache } from "@d2/interfaces";
import { COMMS_CACHE_KEYS } from "../../../../cache-keys.js";

export interface GetChannelPreferenceInput {
  readonly contactId: string;
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
    if (!input.contactId) {
      return D2Result.validationFailed({
        inputErrors: [["contactId", "Contact ID is required."]],
      });
    }

    const cacheKey = COMMS_CACHE_KEYS.channelPref(input.contactId);

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get.handleAsync({ key: cacheKey });
      if (cached.success && cached.data?.value !== undefined) {
        return D2Result.ok({ data: { pref: cached.data.value } });
      }
    }

    // Fetch from DB
    let pref: ChannelPreference | null = null;
    const result = await this.repo.findByContactId.handleAsync({ contactId: input.contactId });
    if (result.success && result.data) pref = result.data.pref;

    // Populate cache on miss
    if (this.cache && pref) {
      await this.cache.set.handleAsync({ key: cacheKey, value: pref, expirationMs: 900_000 });
    }

    if (!pref) {
      return D2Result.notFound({
        messages: [`No channel preferences found for contact ${input.contactId}.`],
      });
    }

    return D2Result.ok({ data: { pref } });
  }
}
