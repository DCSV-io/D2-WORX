import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ parent }) => {
  const { session } = await parent();

  // Step 5: Uncomment to require authentication for onboarding
  // if (!session) {
  //   redirect(303, "/sign-in");
  // }

  return {};
};
