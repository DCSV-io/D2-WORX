import { cleanStr, generateUuidV7 } from "@d2/utilities";
import { AuthValidationError } from "../exceptions/auth-validation-error.js";

/**
 * Junction entity linking an Organization to a Geo Contact via ext key.
 * Auth stores no contact data directly — the junction row's own ID is used
 * as the relatedEntityId with contextKey="org_contact" to access Geo contacts.
 */
export interface OrgContact {
  readonly id: string;
  readonly organizationId: string;
  readonly label: string;
  readonly isPrimary: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateOrgContactInput {
  readonly organizationId: string;
  readonly label: string;
  readonly isPrimary?: boolean;
  readonly id?: string;
}

export interface UpdateOrgContactInput {
  readonly label?: string;
  readonly isPrimary?: boolean;
}

export function createOrgContact(input: CreateOrgContactInput): OrgContact {
  if (!input.organizationId) {
    throw new AuthValidationError(
      "OrgContact",
      "organizationId",
      input.organizationId,
      "is required.",
    );
  }

  const label = cleanStr(input.label);
  if (!label) {
    throw new AuthValidationError("OrgContact", "label", input.label, "is required.");
  }

  return {
    id: input.id ?? generateUuidV7(),
    organizationId: input.organizationId,
    label,
    isPrimary: input.isPrimary ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function updateOrgContact(
  orgContact: OrgContact,
  updates: UpdateOrgContactInput,
): OrgContact {
  let label = orgContact.label;
  if (updates.label !== undefined) {
    const cleaned = cleanStr(updates.label);
    if (!cleaned) {
      throw new AuthValidationError("OrgContact", "label", updates.label, "is required.");
    }
    label = cleaned;
  }

  return {
    ...orgContact,
    label,
    isPrimary: updates.isPrimary ?? orgContact.isPrimary,
    updatedAt: new Date(),
  };
}
