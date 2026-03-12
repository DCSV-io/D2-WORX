import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LOCALES,
  BASE_LOCALE,
  isValidLocale,
  resolveLocale,
  type SupportedLocale,
} from "@d2/i18n";

describe("SUPPORTED_LOCALES", () => {
  it("contains exactly the expected locales", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "es", "de", "fr", "ja"]);
  });

  it("is readonly (as const tuple)", () => {
    // `as const` makes it a readonly tuple at compile time.
    // Verify it's a plain array with the expected length.
    expect(Array.isArray(SUPPORTED_LOCALES)).toBe(true);
    expect(SUPPORTED_LOCALES).toHaveLength(5);
  });
});

describe("BASE_LOCALE", () => {
  it("is 'en'", () => {
    expect(BASE_LOCALE).toBe("en");
  });

  it("is included in SUPPORTED_LOCALES", () => {
    expect(SUPPORTED_LOCALES).toContain(BASE_LOCALE);
  });
});

describe("isValidLocale", () => {
  it.each(["en", "es", "de", "fr", "ja"] as const)("returns true for '%s'", (locale) => {
    expect(isValidLocale(locale)).toBe(true);
  });

  it.each(["jp", "EN", "En", "english", "zh", "pt", "", "  "])(
    "returns false for '%s'",
    (locale) => {
      expect(isValidLocale(locale)).toBe(false);
    },
  );

  it("returns false for undefined cast to string", () => {
    expect(isValidLocale(undefined as unknown as string)).toBe(false);
  });
});

describe("resolveLocale", () => {
  it.each(["en", "es", "de", "fr", "ja"] as const)(
    "returns '%s' when given a valid locale",
    (locale) => {
      expect(resolveLocale(locale)).toBe(locale);
    },
  );

  it("falls back to BASE_LOCALE for null", () => {
    expect(resolveLocale(null)).toBe(BASE_LOCALE);
  });

  it("falls back to BASE_LOCALE for undefined", () => {
    expect(resolveLocale(undefined)).toBe(BASE_LOCALE);
  });

  it("falls back to BASE_LOCALE for empty string", () => {
    expect(resolveLocale("")).toBe(BASE_LOCALE);
  });

  it("falls back to BASE_LOCALE for unsupported locale", () => {
    expect(resolveLocale("zh")).toBe(BASE_LOCALE);
  });

  it("falls back to BASE_LOCALE for 'jp' (old code)", () => {
    expect(resolveLocale("jp")).toBe(BASE_LOCALE);
  });

  it("is case-sensitive — 'EN' is not valid", () => {
    expect(resolveLocale("EN")).toBe(BASE_LOCALE);
  });

  it("return type is SupportedLocale", () => {
    const result: SupportedLocale = resolveLocale("garbage");
    expect(result).toBe(BASE_LOCALE);
  });
});
