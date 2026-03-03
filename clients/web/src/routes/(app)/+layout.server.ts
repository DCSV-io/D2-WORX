import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ parent }) => {
  const { session } = await parent();

  // Step 5: Uncomment to require authentication + active org
  // if (!session) {
  //   redirect(303, "/sign-in");
  // }
  // if (!session.activeOrganizationId) {
  //   redirect(303, "/welcome");
  // }

  // Hardcoded stubs — Step 5 will derive from session
  return {
    orgType: session?.activeOrganizationType ?? "customer",
    role: session?.activeOrganizationRole ?? "owner",
  };
};
