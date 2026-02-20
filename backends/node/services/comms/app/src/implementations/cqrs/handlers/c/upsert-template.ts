import { z } from "zod";
import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { createTemplateWrapper, updateTemplateWrapper } from "@d2/comms-domain";
import type { Channel, TemplateWrapper } from "@d2/comms-domain";
import type { TemplateWrapperRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { InMemoryCache } from "@d2/interfaces";

const schema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(["email", "sms"]),
  subjectTemplate: z.string().max(500).nullable().optional(),
  bodyTemplate: z.string().min(1).max(50_000),
  active: z.boolean().optional(),
});

export interface UpsertTemplateInput {
  readonly name: string;
  readonly channel: Channel;
  readonly bodyTemplate: string;
  readonly subjectTemplate?: string | null;
  readonly active?: boolean;
}

export interface UpsertTemplateOutput {
  readonly template: TemplateWrapper;
}

export class UpsertTemplate extends BaseHandler<UpsertTemplateInput, UpsertTemplateOutput> {
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
    input: UpsertTemplateInput,
  ): Promise<D2Result<UpsertTemplateOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Check if template already exists
    const existing = await this.repo.findByNameAndChannel.handleAsync({
      name: input.name,
      channel: input.channel,
    });

    let template: TemplateWrapper;
    if (existing.success && existing.data?.template) {
      template = updateTemplateWrapper(existing.data.template, {
        subjectTemplate: input.subjectTemplate,
        bodyTemplate: input.bodyTemplate,
        active: input.active,
      });
      await this.repo.update.handleAsync({ template });
    } else {
      template = createTemplateWrapper({
        name: input.name,
        channel: input.channel,
        bodyTemplate: input.bodyTemplate,
        subjectTemplate: input.subjectTemplate,
        active: input.active,
      });
      await this.repo.create.handleAsync({ template });
    }

    // Update cache
    if (this.cache) {
      const cacheKey = `template:${input.name}:${input.channel}`;
      await this.cache.set.handleAsync({ key: cacheKey, value: template, expirationMs: 1_800_000 });
    }

    return D2Result.ok({ data: { template }, traceId: this.traceId });
  }
}
