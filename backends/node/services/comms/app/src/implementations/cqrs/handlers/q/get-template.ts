import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { Channel, TemplateWrapper } from "@d2/comms-domain";
import type { TemplateWrapperRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { InMemoryCache } from "@d2/interfaces";

export interface GetTemplateInput {
  readonly name: string;
  readonly channel: Channel;
}

export interface GetTemplateOutput {
  readonly template: TemplateWrapper | null;
}

export class GetTemplate extends BaseHandler<GetTemplateInput, GetTemplateOutput> {
  private readonly repo: TemplateWrapperRepoHandlers;
  private readonly cache?: {
    get: InMemoryCache.IGetHandler<TemplateWrapper>;
    set: InMemoryCache.ISetHandler<TemplateWrapper>;
  };

  constructor(
    repo: TemplateWrapperRepoHandlers,
    context: IHandlerContext,
    cache?: {
      get: InMemoryCache.IGetHandler<TemplateWrapper>;
      set: InMemoryCache.ISetHandler<TemplateWrapper>;
    },
  ) {
    super(context);
    this.repo = repo;
    this.cache = cache;
  }

  protected async executeAsync(
    input: GetTemplateInput,
  ): Promise<D2Result<GetTemplateOutput | undefined>> {
    const cacheKey = `template:${input.name}:${input.channel}`;

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get.handleAsync({ key: cacheKey });
      if (cached.success && cached.data?.value !== undefined) {
        return D2Result.ok({ data: { template: cached.data.value } });
      }
    }

    // Fetch from DB
    const result = await this.repo.findByNameAndChannel.handleAsync({
      name: input.name,
      channel: input.channel,
    });

    const template = result.success ? (result.data?.template ?? null) : null;

    // Populate cache
    if (this.cache && template) {
      await this.cache.set.handleAsync({ key: cacheKey, value: template, expirationMs: 1_800_000 });
    }

    return D2Result.ok({ data: { template } });
  }
}
