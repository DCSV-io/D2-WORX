import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import { revokeEmulationConsent, isConsentActive } from "@d2/auth-domain";
import type {
  IFindEmulationConsentByIdHandler,
  IRevokeEmulationConsentRecordHandler,
} from "../../../../interfaces/repository/handlers/index.js";
import { Commands } from "../../../../interfaces/cqrs/handlers/index.js";

type Input = Commands.RevokeEmulationConsentInput;
type Output = Commands.RevokeEmulationConsentOutput;

const schema = z.object({
  consentId: zodGuid,
  userId: zodGuid,
});

/**
 * Revokes an existing emulation consent.
 * Only active (non-revoked, non-expired) consents can be revoked.
 * Verifies the consent belongs to the authenticated user.
 */
export class RevokeEmulationConsent
  extends BaseHandler<Input, Output>
  implements Commands.IRevokeEmulationConsentHandler
{
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
    input: Input,
  ): Promise<D2Result<Output | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.findById.handleAsync({ id: input.consentId });
    if (!findResult.success || !findResult.data) {
      return D2Result.notFound();
    }

    const existing = findResult.data.consent;

    // Ownership check: consent must belong to the authenticated user
    if (existing.userId !== input.userId) {
      return D2Result.forbidden({
        messages: ["Not authorized to revoke this consent."],
      });
    }

    if (!isConsentActive(existing)) {
      return D2Result.conflict({
        messages: ["Consent is already revoked or expired."],
      });
    }

    const revoked = revokeEmulationConsent(existing);
    const revokeResult = await this.revokeRecord.handleAsync({ id: input.consentId });
    if (!revokeResult.success) return D2Result.bubbleFail(revokeResult);

    return D2Result.ok({ data: { consent: revoked } });
  }
}

export type { RevokeEmulationConsentInput, RevokeEmulationConsentOutput } from "../../../../interfaces/cqrs/handlers/c/revoke-emulation-consent.js";
