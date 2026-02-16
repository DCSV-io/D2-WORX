import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import { createSignInEvent, type CreateSignInEventInput, type SignInEvent } from "@d2/auth-domain";
import type { ISignInEventRepository } from "../../../../interfaces/repository/sign-in-event-repository.js";

export interface RecordSignInEventInput {
  readonly userId: string;
  readonly successful: boolean;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly whoIsId?: string | null;
}

export type RecordSignInEventOutput = { event: SignInEvent };

const schema = z.object({
  userId: zodGuid,
  successful: z.boolean(),
  ipAddress: z.string().max(45),
  userAgent: z.string().max(512),
  whoIsId: z.string().max(64).nullish(),
});

/**
 * Records a sign-in event for audit purposes.
 * Validates input via Zod schema before persisting.
 */
export class RecordSignInEvent extends BaseHandler<
  RecordSignInEventInput,
  RecordSignInEventOutput
> {
  private readonly repo: ISignInEventRepository;

  constructor(repo: ISignInEventRepository, context: IHandlerContext) {
    super(context);
    this.repo = repo;
  }

  protected async executeAsync(
    input: RecordSignInEventInput,
  ): Promise<D2Result<RecordSignInEventOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const createInput: CreateSignInEventInput = {
      userId: input.userId,
      successful: input.successful,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      whoIsId: input.whoIsId,
    };

    const event = createSignInEvent(createInput);
    await this.repo.create(event);

    return D2Result.ok({ data: { event }, traceId: this.traceId });
  }
}
