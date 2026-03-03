import { requireOrg } from "@d2/auth-bff-client";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  const { session } = requireOrg(locals);

  return {
    orgType: session.activeOrganizationType,
    role: session.activeOrganizationRole,
  };
};
