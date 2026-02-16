import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { EmulationConsent } from "@d2/auth-domain";
import type { IEmulationConsentRepository } from "../../../../interfaces/repository/emulation-consent-repository.js";

export interface GetActiveConsentsInput {
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetActiveConsentsOutput {
  consents: EmulationConsent[];
}

const schema = z.object({
  userId: zodGuid,
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * Retrieves active (non-revoked, non-expired) emulation consents for a user.
 */
export class GetActiveConsents extends BaseHandler<
  GetActiveConsentsInput,
  GetActiveConsentsOutput
> {
  private readonly repo: IEmulationConsentRepository;

  constructor(repo: IEmulationConsentRepository, context: IHandlerContext) {
    super(context);
    this.repo = repo;
  }

  protected async executeAsync(
    input: GetActiveConsentsInput,
  ): Promise<D2Result<GetActiveConsentsOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const consents = await this.repo.findActiveByUserId(
      input.userId,
      input.limit ?? 50,
      input.offset ?? 0,
    );

    return D2Result.ok({ data: { consents }, traceId: this.traceId });
  }
}
