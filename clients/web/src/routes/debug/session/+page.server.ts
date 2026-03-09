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

  // Serialize requestInfo (it's a frozen object with readonly props)
  const requestInfo = locals.requestInfo
    ? {
        clientIp: locals.requestInfo.clientIp,
        serverFingerprint: locals.requestInfo.serverFingerprint,
        clientFingerprint: locals.requestInfo.clientFingerprint ?? null,
        whoIsHashId: locals.requestInfo.whoIsHashId ?? null,
        city: locals.requestInfo.city ?? null,
        countryCode: locals.requestInfo.countryCode ?? null,
        subdivisionCode: locals.requestInfo.subdivisionCode ?? null,
        isVpn: locals.requestInfo.isVpn ?? null,
        isProxy: locals.requestInfo.isProxy ?? null,
        isTor: locals.requestInfo.isTor ?? null,
        isHosting: locals.requestInfo.isHosting ?? null,
        userId: locals.requestInfo.userId ?? null,
        isAuthenticated: locals.requestInfo.isAuthenticated,
        isTrustedService: locals.requestInfo.isTrustedService,
      }
    : null;

  return {
    debugSession: locals.session ?? null,
    debugUser: locals.user ?? null,
    requestInfo,
    cookieNames,
  };
};
