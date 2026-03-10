import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, request }) => {
  if (!dev) {
    error(404, "Not found");
  }

  // Extract cookie names (not values — security)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter(Boolean);

  // Serialize requestContext (it's a frozen object with readonly props)
  const requestContext = locals.requestContext
    ? {
        clientIp: locals.requestContext.clientIp ?? null,
        serverFingerprint: locals.requestContext.serverFingerprint ?? null,
        clientFingerprint: locals.requestContext.clientFingerprint ?? null,
        deviceFingerprint: locals.requestContext.deviceFingerprint ?? null,
        whoIsHashId: locals.requestContext.whoIsHashId ?? null,
        city: locals.requestContext.city ?? null,
        countryCode: locals.requestContext.countryCode ?? null,
        subdivisionCode: locals.requestContext.subdivisionCode ?? null,
        isVpn: locals.requestContext.isVpn ?? null,
        isProxy: locals.requestContext.isProxy ?? null,
        isTor: locals.requestContext.isTor ?? null,
        isHosting: locals.requestContext.isHosting ?? null,
        userId: locals.requestContext.userId ?? null,
        isAuthenticated: locals.requestContext.isAuthenticated,
        isTrustedService: locals.requestContext.isTrustedService ?? false,
      }
    : null;

  return {
    debugSession: locals.session ?? null,
    debugUser: locals.user ?? null,
    requestContext,
    cookieNames,
  };
};
