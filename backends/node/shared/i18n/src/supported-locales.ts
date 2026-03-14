import { parseEnvArray } from "@d2/service-defaults/config";

/**
 * Normalise any locale tag to canonical BCP 47 casing:
 * lowercase language, uppercase region (e.g. "en-us" → "en-US", "FR-CA" → "fr-CA").
 * Bare language codes are lowercased (e.g. "EN" → "en").
 */
export function toBcp47(tag: string): string {
  const dash = tag.indexOf("-");
  if (dash < 0) return tag.toLowerCase();
  return tag.substring(0, dash).toLowerCase() + tag.substring(dash).toUpperCase();
}

export const BASE_LOCALE = toBcp47((process.env["PUBLIC_DEFAULT_LOCALE"] ?? "en-US").trim());

const parsed = parseEnvArray("PUBLIC_ENABLED_LOCALES");
export const SUPPORTED_LOCALES: readonly string[] =
  parsed.length > 0 ? parsed.map((l: string) => toBcp47(l.trim())) : [BASE_LOCALE];

export function isValidLocale(locale: string): boolean {
  return SUPPORTED_LOCALES.includes(toBcp47(locale));
}

/** First locale per language prefix wins (e.g., en -> en-US). */
export const LANGUAGE_DEFAULTS: Readonly<Record<string, string>> = Object.fromEntries(
  SUPPORTED_LOCALES.reduce<[string, string][]>((acc, locale) => {
    const lang = locale.includes("-") ? locale.split("-")[0]! : locale;
    if (!acc.some(([k]) => k === lang)) acc.push([lang, locale]);
    return acc;
  }, []),
);

export function resolveLocale(locale: string | null | undefined): string {
  if (!locale) return BASE_LOCALE;
  const canonical = toBcp47(locale.trim());
  if (SUPPORTED_LOCALES.includes(canonical)) return canonical;
  const lang = canonical.includes("-") ? canonical.split("-")[0]! : canonical;
  return LANGUAGE_DEFAULTS[lang] ?? BASE_LOCALE;
}
