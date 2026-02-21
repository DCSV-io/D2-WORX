import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import { createChannelPreference, updateChannelPreference } from "@d2/comms-domain";
import type { ChannelPreference } from "@d2/comms-domain";
import type { ChannelPreferenceRepoHandlers } from "../../../../interfaces/repository/handlers/index.js";
import type { InMemoryCache } from "@d2/interfaces";

const schema = z
  .object({
    userId: zodGuid.optional(),
    contactId: zodGuid.optional(),
    emailEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
    quietHoursTz: z.string().max(50).nullable().optional(),
  })
  .refine((d) => d.userId || d.contactId, {
    message: "At least one of userId or contactId is required.",
  });

export interface SetChannelPreferenceInput {
  readonly userId?: string;
  readonly contactId?: string;
  readonly emailEnabled?: boolean;
  readonly smsEnabled?: boolean;
  readonly quietHoursStart?: string | null;
  readonly quietHoursEnd?: string | null;
  readonly quietHoursTz?: string | null;
}

export interface SetChannelPreferenceOutput {
  readonly pref: ChannelPreference;
}

export class SetChannelPreference extends BaseHandler<
  SetChannelPreferenceInput,
  SetChannelPreferenceOutput
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
    input: SetChannelPreferenceInput,
  ): Promise<D2Result<SetChannelPreferenceOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    // Check if existing pref exists
    let existing: ChannelPreference | null = null;
    if (input.userId) {
      const result = await this.repo.findByUserId.handleAsync({ userId: input.userId });
      if (result.success && result.data) existing = result.data.pref;
    } else if (input.contactId) {
      const result = await this.repo.findByContactId.handleAsync({ contactId: input.contactId });
      if (result.success && result.data) existing = result.data.pref;
    }

    let pref: ChannelPreference;
    if (existing) {
      pref = updateChannelPreference(existing, {
        emailEnabled: input.emailEnabled,
        smsEnabled: input.smsEnabled,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        quietHoursTz: input.quietHoursTz,
      });
      await this.repo.update.handleAsync({ pref });
    } else {
      pref = createChannelPreference({
        userId: input.userId,
        contactId: input.contactId,
        emailEnabled: input.emailEnabled,
        smsEnabled: input.smsEnabled,
        quietHoursStart: input.quietHoursStart,
        quietHoursEnd: input.quietHoursEnd,
        quietHoursTz: input.quietHoursTz,
      });
      await this.repo.create.handleAsync({ pref });
    }

    // Evict + repopulate cache
    if (this.cache) {
      const cacheKey = input.userId
        ? `chan-pref:user:${input.userId}`
        : `chan-pref:contact:${input.contactId}`;
      await this.cache.set.handleAsync({ key: cacheKey, value: pref, expirationMs: 900_000 });
    }

    return D2Result.ok({ data: { pref }, traceId: this.traceId });
  }
}
