import { isValidLocale, resolveLocale, BASE_LOCALE, LANGUAGE_DEFAULTS, toBcp47 } from "@d2/i18n";

/**
 * Resolves the request locale from headers.
 * Priority: D2-Locale header -> Accept-Language (quality-weighted) -> "en-US" fallback.
 *
 * @param d2Locale - Value of the D2-Locale header (or undefined)
 * @param acceptLanguage - Value of the Accept-Language header (or undefined)
 * @returns A supported locale code
 */
export function resolveRequestLocale(
  d2Locale: string | undefined,
  acceptLanguage: string | undefined,
): string {
  // 1. Explicit header from SvelteKit
  if (d2Locale) {
    return resolveLocale(d2Locale);
  }

  // 2. Accept-Language header (browser default)
  if (acceptLanguage) {
    // First pass: exact match
    for (const tag of parseAcceptLanguage(acceptLanguage)) {
      if (isValidLocale(tag)) {
        return toBcp47(tag);
      }
    }

    // Second pass: language-family defaults
    for (const tag of parseAcceptLanguage(acceptLanguage)) {
      const dash = tag.indexOf("-");
      const lang = dash > 0 ? tag.slice(0, dash) : tag;
      if (lang in LANGUAGE_DEFAULTS) {
        return LANGUAGE_DEFAULTS[lang]!;
      }
    }
  }

  return BASE_LOCALE;
}

/**
 * Parses an Accept-Language header value into locale tags sorted by
 * quality weight descending. For example, "fr-CA,fr;q=0.9,en;q=0.8"
 * yields ["fr-ca", "fr", "en"].
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [tag = "", ...rest] = part.split(";");
      let quality = 1.0;
      for (const segment of rest) {
        const trimmed = segment.trim();
        if (trimmed.toLowerCase().startsWith("q=")) {
          const parsed = parseFloat(trimmed.slice(2));
          if (!Number.isNaN(parsed)) {
            quality = parsed;
          }
        }
      }
      return { tag: tag.trim().toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality)
    .map((x) => x.tag);
}
