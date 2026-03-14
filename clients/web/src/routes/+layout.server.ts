import { env } from "$env/dynamic/public";
import { localesToOptions, type LocaleOption } from "$lib/shared/forms/locale-options.js";
import { getGeoRefData } from "$lib/server/geo-ref-data.server.js";
import type { LayoutServerLoad } from "./$types";

/** Read PUBLIC_ENABLED_LOCALES__0, PUBLIC_ENABLED_LOCALES__1, ... from env. */
function readEnabledLocales(): string[] {
  const result: string[] = [];
  for (let i = 0; ; i++) {
    const value = env[`PUBLIC_ENABLED_LOCALES__${i}`];
    if (!value) break;
    result.push(value.trim());
  }
  return result.length > 0 ? result : [env.PUBLIC_DEFAULT_LOCALE ?? "en-US"];
}

/** Computed once at module load — enabled locales don't change at runtime. */
const enabledLocales = readEnabledLocales();

/**
 * Module-level cache for locale options. Populated on first request from
 * Geo ref data (memory-cached after first gRPC call). Only caches when
 * Geo is available — if down, returns code-only fallback without caching
 * so the next request retries.
 */
let cachedLocaleOptions: LocaleOption[] | null = null;

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Reading url.pathname makes SvelteKit track it as a dependency.
  // The root layout re-runs on every client-side navigation, keeping
  // auth state ($page.data.session) fresh after sign-in/sign-out.
  // Cost is negligible — this loader just reads locals.
  void url.pathname;

  if (!cachedLocaleOptions) {
    const refData = await getGeoRefData();
    if (refData) {
      cachedLocaleOptions = localesToOptions(refData.locales, enabledLocales);
    }
  }

  // Fallback when Geo is unavailable: show locale codes without endonyms/flags.
  const localeOptions =
    cachedLocaleOptions ?? enabledLocales.map((code) => ({ code, endonym: code, flag: "" }));

  return {
    session: locals.session ?? null,
    user: locals.user ?? null,
    localeOptions,
  };
};
