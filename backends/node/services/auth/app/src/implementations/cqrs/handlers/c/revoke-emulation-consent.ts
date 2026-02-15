import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import { revokeEmulationConsent, isConsentActive, type EmulationConsent } from "@d2/auth-domain";
import type { IEmulationConsentRepository } from "../../../../interfaces/repository/emulation-consent-repository.js";

export interface RevokeEmulationConsentInput {
  readonly consentId: string;
  /** The authenticated user's ID — used to verify ownership. */
  readonly userId: string;
}

export type RevokeEmulationConsentOutput = { consent: EmulationConsent };

const schema = z.object({
  consentId: zodGuid,
  userId: zodGuid,
});

/**
 * Revokes an existing emulation consent.
 * Only active (non-revoked, non-expired) consents can be revoked.
 * Verifies the consent belongs to the authenticated user.
 */
export class RevokeEmulationConsent extends BaseHandler<
  RevokeEmulationConsentInput,
  RevokeEmulationConsentOutput
> {
  private readonly repo: IEmulationConsentRepository;

  constructor(repo: IEmulationConsentRepository, context: IHandlerContext) {
    super(context);
    this.repo = repo;
  }

  protected async executeAsync(
    input: RevokeEmulationConsentInput,
  ): Promise<D2Result<RevokeEmulationConsentOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const existing = await this.repo.findById(input.consentId);
    if (!existing) {
      return D2Result.notFound({ traceId: this.traceId });
    }

    // Ownership check: consent must belong to the authenticated user
    if (existing.userId !== input.userId) {
      return D2Result.fail({
        messages: ["Not authorized to revoke this consent."],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
        traceId: this.traceId,
      });
    }

    if (!isConsentActive(existing)) {
      return D2Result.fail({
        messages: ["Consent is already revoked or expired."],
        statusCode: HttpStatusCode.Conflict,
        errorCode: ErrorCodes.CONFLICT,
        traceId: this.traceId,
      });
    }

    const revoked = revokeEmulationConsent(existing);
    await this.repo.revoke(input.consentId);

    return D2Result.ok({ data: { consent: revoked }, traceId: this.traceId });
  }
}
