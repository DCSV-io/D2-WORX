import { requireAuth } from "@d2/auth-bff-client";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  requireAuth(locals);
  return {};
};
