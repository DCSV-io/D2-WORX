export const SUPPORTED_LOCALES = ["en", "es", "de", "fr", "ja"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const BASE_LOCALE: SupportedLocale = "en";

export function isValidLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

export function resolveLocale(locale: string | null | undefined): SupportedLocale {
  return locale && isValidLocale(locale) ? locale : BASE_LOCALE;
}
