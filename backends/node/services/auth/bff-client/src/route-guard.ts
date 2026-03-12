/**
 * Route protection helpers for SvelteKit layout server loaders.
 *
 * These throw SvelteKit redirects (which are caught by the framework,
 * not treated as errors) to enforce auth requirements at the route level.
 */
import { redirect } from "@sveltejs/kit";
import type { AuthSession, AuthUser } from "./types.js";

interface Locals {
  session?: AuthSession | null;
  user?: AuthUser | null;
}

/** Session + user guaranteed non-null after requireAuth(). */
export interface AuthenticatedLocals {
  session: AuthSession;
  user: AuthUser;
}

/** Session with active org guaranteed after requireOrg(). */
export interface AuthenticatedWithOrgLocals extends AuthenticatedLocals {
  session: AuthSession & {
    activeOrganizationId: string;
    activeOrganizationType: string;
    activeOrganizationRole: string;
  };
}

/**
 * Builds a sign-in redirect URL, optionally appending `?returnTo=` so the
 * user lands back where they were after authenticating.
 */
function signInUrl(url?: URL): string {
  if (!url) return "/sign-in";

  const returnTo = url.pathname + url.search;
  if (returnTo === "/" || returnTo === "") return "/sign-in";

  return `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Requires the user to be authenticated.
 * Throws a redirect to /sign-in if no session exists.
 *
 * @param url - Optional SvelteKit request URL. When provided, appends
 *   `?returnTo=` so the user returns to their intended page after sign-in.
 */
export function requireAuth(locals: Locals, url?: URL): AuthenticatedLocals {
  if (!locals.session || !locals.user) {
    redirect(303, signInUrl(url));
  }

  return { session: locals.session, user: locals.user };
}

/**
 * Requires the user to be authenticated AND have an active organization.
 * Throws a redirect to /sign-in if not authenticated, or /welcome if no active org.
 *
 * @param url - Optional SvelteKit request URL, forwarded to {@link requireAuth}.
 */
export function requireOrg(locals: Locals, url?: URL): AuthenticatedWithOrgLocals {
  const { session, user } = requireAuth(locals, url);

  if (
    !session.activeOrganizationId ||
    !session.activeOrganizationType ||
    !session.activeOrganizationRole
  ) {
    redirect(303, "/welcome");
  }

  return {
    session: session as AuthenticatedWithOrgLocals["session"],
    user,
  };
}

/**
 * Redirects authenticated users away from auth pages (sign-in, sign-up).
 * Throws a redirect to the target URL if the user is already signed in.
 */
export function redirectIfAuthenticated(locals: Locals, to: string = "/dashboard"): void {
  if (locals.session && locals.user) {
    redirect(303, to);
  }
}
