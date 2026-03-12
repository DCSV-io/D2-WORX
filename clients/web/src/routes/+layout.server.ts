import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Reading url.pathname makes SvelteKit track it as a dependency.
  // The root layout re-runs on every client-side navigation, keeping
  // auth state ($page.data.session) fresh after sign-in/sign-out.
  // Cost is negligible — this loader just reads locals.
  void url.pathname;

  return {
    session: locals.session ?? null,
    user: locals.user ?? null,
  };
};
