/**
 * GeoRefData → UI option array transforms.
 *
 * Converts raw proto maps (keyed by ISO codes) into combobox-friendly
 * option arrays with display labels, flag paths, phone prefixes, etc.
 */
import type { CountryDTO, SubdivisionDTO } from "@d2/protos";
import { getCountryCallingCode } from "./phone-format.js";

export interface CountryOption {
  /** ISO 3166-1 alpha-2 code (e.g. "US"). */
  value: string;
  /** Display name (e.g. "United States"). */
  label: string;
  /** Path to flag SVG (e.g. "/flags/4x3/us.svg"). */
  flag: string;
  /** International calling code (e.g. "+1"). */
  phonePrefix: string;
  /** Phone number format hint from proto (e.g. "XXX-XXX-XXXX"). */
  phoneFormat: string;
  /** ISO 3166-2 codes for this country's subdivisions. */
  subdivisionCodes: string[];
}

export interface SubdivisionOption {
  /** ISO 3166-2 code (e.g. "US-CA"). */
  value: string;
  /** Display name (e.g. "California"). */
  label: string;
}

/**
 * Convert a countries map to a sorted option array.
 * Sorted alphabetically by display name.
 */
export function countriesToOptions(
  countries: Record<string, CountryDTO>,
): CountryOption[] {
  return Object.values(countries)
    .map((c) => ({
      value: c.iso31661Alpha2Code,
      label: c.displayName,
      flag: `/flags/4x3/${c.iso31661Alpha2Code.toLowerCase()}.svg`,
      phonePrefix: c.phoneNumberPrefix
        ? `+${c.phoneNumberPrefix}`
        : getCountryCallingCode(c.iso31661Alpha2Code),
      phoneFormat: c.phoneNumberFormat,
      subdivisionCodes: c.subdivisionIso31662Codes ?? [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Filter subdivisions for a specific country.
 * Returns a sorted option array.
 */
export function subdivisionsForCountry(
  subdivisions: Record<string, SubdivisionDTO>,
  countryIso2: string,
): SubdivisionOption[] {
  return Object.values(subdivisions)
    .filter((s) => s.countryIso31661Alpha2Code === countryIso2)
    .map((s) => ({
      value: s.iso31662Code,
      label: s.displayName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
