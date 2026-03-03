import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  // Step 5 will wire real session resolution from locals
  return {
    session: locals.session ?? null,
    user: locals.user ?? null,
  };
};
