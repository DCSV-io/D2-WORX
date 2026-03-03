import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    session: locals.session ?? null,
    user: locals.user ?? null,
  };
};
