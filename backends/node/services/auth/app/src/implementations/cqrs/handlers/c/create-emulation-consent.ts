import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import {
  createEmulationConsent,
  canEmulate,
  ORG_TYPES,
  type EmulationConsent,
  type OrgType,
} from "@d2/auth-domain";
import type {
  ICreateEmulationConsentRecordHandler,
  IFindActiveConsentByUserIdAndOrgHandler,
} from "../../../../interfaces/repository/handlers/index.js";

export interface CreateEmulationConsentInput {
  readonly userId: string;
  readonly grantedToOrgId: string;
  readonly activeOrgType: OrgType;
  readonly expiresAt: Date;
}

export type CreateEmulationConsentOutput = { consent: EmulationConsent };

/** Maximum consent duration: 30 days in milliseconds. */
const MAX_CONSENT_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const schema = z.object({
  userId: zodGuid,
  grantedToOrgId: zodGuid,
  activeOrgType: z.enum(ORG_TYPES),
  expiresAt: z
    .date()
    .refine((d) => d.getTime() > Date.now(), "expiresAt must be in the future.")
    .refine(
      (d) => d.getTime() - Date.now() <= MAX_CONSENT_DURATION_MS,
      "Consent duration cannot exceed 30 days.",
    ),
});

/**
 * Creates an emulation consent record.
 *
 * Validates input, checks org type can emulate, verifies the target org
 * exists, and prevents duplicate active consents for the same user+org.
 */
export class CreateEmulationConsent extends BaseHandler<
  CreateEmulationConsentInput,
  CreateEmulationConsentOutput
> {
  private readonly createRecord: ICreateEmulationConsentRecordHandler;
  private readonly findActiveByUserIdAndOrg: IFindActiveConsentByUserIdAndOrgHandler;
  private readonly checkOrgExists: (orgId: string) => Promise<boolean>;

  constructor(
    createRecord: ICreateEmulationConsentRecordHandler,
    findActiveByUserIdAndOrg: IFindActiveConsentByUserIdAndOrgHandler,
    context: IHandlerContext,
    checkOrgExists: (orgId: string) => Promise<boolean>,
  ) {
    super(context);
    this.createRecord = createRecord;
    this.findActiveByUserIdAndOrg = findActiveByUserIdAndOrg;
    this.checkOrgExists = checkOrgExists;
  }

  protected async executeAsync(
    input: CreateEmulationConsentInput,
  ): Promise<D2Result<CreateEmulationConsentOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    if (!canEmulate(input.activeOrgType)) {
      return D2Result.fail({
        messages: [`Organization type "${input.activeOrgType}" is not allowed to emulate.`],
        statusCode: HttpStatusCode.Forbidden,
        errorCode: ErrorCodes.FORBIDDEN,
        traceId: this.traceId,
      });
    }

    // Verify target org exists
    const orgExists = await this.checkOrgExists(input.grantedToOrgId);
    if (!orgExists) {
      return D2Result.fail({
        messages: ["Target organization not found."],
        statusCode: HttpStatusCode.NotFound,
        errorCode: ErrorCodes.NOT_FOUND,
        traceId: this.traceId,
      });
    }

    // Prevent duplicate active consents for same user+org
    const findResult = await this.findActiveByUserIdAndOrg.handleAsync({
      userId: input.userId,
      grantedToOrgId: input.grantedToOrgId,
    });
    if (findResult.success && findResult.data?.consent) {
      return D2Result.fail({
        messages: ["An active consent already exists for this organization."],
        statusCode: HttpStatusCode.Conflict,
        errorCode: ErrorCodes.CONFLICT,
        traceId: this.traceId,
      });
    }

    const consent = createEmulationConsent({
      userId: input.userId,
      grantedToOrgId: input.grantedToOrgId,
      expiresAt: input.expiresAt,
    });

    const createResult = await this.createRecord.handleAsync({ consent });
    if (!createResult.success) return D2Result.bubbleFail(createResult);

    return D2Result.ok({ data: { consent }, traceId: this.traceId });
  }
}
