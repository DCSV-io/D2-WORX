/**
 * Locale option transforms for the language selector.
 *
 * Uses `localesToOptions()` to enrich from Geo `LocaleDTO` ref data (endonym + country code).
 * Geo ref data is memory-cached after the first call, so subsequent layout loads are free.
 */
import type { LocaleDTO } from "@d2/protos";

export interface LocaleOption {
  /** BCP 47 tag (e.g., "en-US"). */
  code: string;
  /** Native display name (e.g., "Français (Canada)"). */
  endonym: string;
  /** Path to flag SVG (e.g., "/flags/4x3/us.svg"). */
  flag: string;
}

/**
 * Transforms Geo locale ref data into UI options, filtered by enabled locales.
 * Endonym and country code come from Geo Locale entity (source of truth).
 * Flag path uses existing static SVG assets at /flags/4x3/{code}.svg.
 */
export function localesToOptions(
  locales: Record<string, LocaleDTO>,
  enabledLocales: string[],
): LocaleOption[] {
  return enabledLocales
    .filter((code) => locales[code])
    .map((code) => {
      const locale = locales[code]!;
      return {
        code: locale.ietfBcp47Tag,
        endonym: locale.endonym,
        flag: `/flags/4x3/${locale.countryIso31661Alpha2Code.toLowerCase()}.svg`,
      };
    });
}
