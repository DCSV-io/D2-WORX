import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import { revokeEmulationConsent, isConsentActive, type EmulationConsent } from "@d2/auth-domain";
import type {
  IFindEmulationConsentByIdHandler,
  IRevokeEmulationConsentRecordHandler,
} from "../../../../interfaces/repository/handlers/index.js";

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
  private readonly findById: IFindEmulationConsentByIdHandler;
  private readonly revokeRecord: IRevokeEmulationConsentRecordHandler;

  constructor(
    findById: IFindEmulationConsentByIdHandler,
    revokeRecord: IRevokeEmulationConsentRecordHandler,
    context: IHandlerContext,
  ) {
    super(context);
    this.findById = findById;
    this.revokeRecord = revokeRecord;
  }

  protected async executeAsync(
    input: RevokeEmulationConsentInput,
  ): Promise<D2Result<RevokeEmulationConsentOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.findById.handleAsync({ id: input.consentId });
    if (!findResult.success || !findResult.data) {
      return D2Result.notFound();
    }

    const existing = findResult.data.consent;

    // Ownership check: consent must belong to the authenticated user
    if (existing.userId !== input.userId) {
      return D2Result.fail({
        messages: ["Not authorized to revoke this consent."],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
      });
    }

    if (!isConsentActive(existing)) {
      return D2Result.fail({
        messages: ["Consent is already revoked or expired."],
        statusCode: HttpStatusCode.Conflict,
        errorCode: ErrorCodes.CONFLICT,
      });
    }

    const revoked = revokeEmulationConsent(existing);
    const revokeResult = await this.revokeRecord.handleAsync({ id: input.consentId });
    if (!revokeResult.success) return D2Result.bubbleFail(revokeResult);

    return D2Result.ok({ data: { consent: revoked } });
  }
}
