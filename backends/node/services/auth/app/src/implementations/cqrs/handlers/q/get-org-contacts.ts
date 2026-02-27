import { z } from "zod";
import { BaseHandler, type IHandlerContext, zodGuid } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { ContactDTO } from "@d2/protos";
import { GEO_CONTEXT_KEYS, type OrgContact } from "@d2/auth-domain";
import type { Queries } from "@d2/geo-client";
import type { IFindOrgContactsByOrgIdHandler } from "../../../../interfaces/repository/handlers/index.js";

/** A junction record hydrated with full Geo contact data. */
export interface HydratedOrgContact {
  readonly id: string;
  readonly organizationId: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Full Geo contact data. Null if the Geo contact was not found (orphaned). */
  readonly geoContact: ContactDTO | null;
}

export interface GetOrgContactsInput {
  readonly organizationId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetOrgContactsOutput {
  contacts: HydratedOrgContact[];
}

const schema = z.object({
  organizationId: zodGuid,
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * Retrieves contacts associated with an organization, hydrated with full
 * Geo contact data via ext keys.
 *
 * Loads junction records from the repo, batch-fetches Geo contact data
 * via GetContactsByExtKeys (using contextKey="auth_org_contact", relatedEntityId=junction.id),
 * then joins the results. Orphaned junctions (where the Geo contact no longer
 * exists) are returned with geoContact: null.
 */
export class GetOrgContacts extends BaseHandler<GetOrgContactsInput, GetOrgContactsOutput> {
  private readonly findByOrgId: IFindOrgContactsByOrgIdHandler;
  private readonly getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler;

  constructor(
    findByOrgId: IFindOrgContactsByOrgIdHandler,
    context: IHandlerContext,
    getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler,
  ) {
    super(context);
    this.findByOrgId = findByOrgId;
    this.getContactsByExtKeys = getContactsByExtKeys;
  }

  protected async executeAsync(
    input: GetOrgContactsInput,
  ): Promise<D2Result<GetOrgContactsOutput | undefined>> {
    const validation = this.validateInput(schema, input);
    if (!validation.success) return D2Result.bubbleFail(validation);

    const findResult = await this.findByOrgId.handleAsync({
      organizationId: input.organizationId,
      limit: input.limit,
      offset: input.offset,
    });

    const junctions: OrgContact[] = findResult.success ? (findResult.data?.contacts ?? []) : [];

    if (junctions.length === 0) {
      return D2Result.ok({ data: { contacts: [] } });
    }

    // Batch fetch Geo contacts using ext keys
    const keys = junctions.map((j) => ({
      contextKey: GEO_CONTEXT_KEYS.ORG_CONTACT,
      relatedEntityId: j.id,
    }));

    let geoContactMap: Map<string, ContactDTO[]> = new Map();

    const geoResult = await this.getContactsByExtKeys.handleAsync({ keys });
    if (geoResult.success && geoResult.data) {
      geoContactMap = geoResult.data.data;
    }

    // Join: each junction gets its matching Geo contact (or null if orphaned)
    const contacts: HydratedOrgContact[] = junctions.map((j) => ({
      id: j.id,
      organizationId: j.organizationId,
      label: j.label,
      isPrimary: j.isPrimary,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      geoContact: geoContactMap.get(`${GEO_CONTEXT_KEYS.ORG_CONTACT}:${j.id}`)?.[0] ?? null,
    }));

    return D2Result.ok({ data: { contacts } });
  }
}
