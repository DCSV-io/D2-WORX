import { isValidOrgType } from "@d2/auth-domain";

/**
 * Organization lifecycle hooks for BetterAuth's organization plugin.
 *
 * Validates that the orgType custom field is a valid OrgType before
 * allowing organization creation.
 */
export function beforeCreateOrganization(org: Record<string, unknown>): boolean {
  const orgType = org["orgType"] ?? org["org_type"];
  if (!isValidOrgType(orgType)) {
    throw new Error(
      `Invalid organization type: "${String(orgType)}". Must be one of: admin, support, customer, third_party, affiliate.`,
    );
  }
  return true;
}
