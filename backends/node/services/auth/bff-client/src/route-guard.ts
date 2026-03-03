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
 * Requires the user to be authenticated.
 * Throws a redirect to /sign-in if no session exists.
 */
export function requireAuth(locals: Locals): AuthenticatedLocals {
  if (!locals.session || !locals.user) {
    redirect(303, "/sign-in");
  }

  return { session: locals.session, user: locals.user };
}

/**
 * Requires the user to be authenticated AND have an active organization.
 * Throws a redirect to /sign-in if not authenticated, or /welcome if no active org.
 */
export function requireOrg(locals: Locals): AuthenticatedWithOrgLocals {
  const { session, user } = requireAuth(locals);

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
