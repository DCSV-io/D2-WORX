import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ parent }) => {
  const { session } = await parent();

  // Step 5: Uncomment to redirect authenticated users away from auth pages
  // if (session) {
  //   redirect(303, "/dashboard");
  // }

  return {};
};
