import { describe, it, expect, vi } from "vitest";

// vi.hoisted() runs BEFORE imports are evaluated, ensuring env vars
// are set before @d2/i18n's module-level parseEnvArray() executes.
vi.hoisted(() => {
  const locales = [
    "en-US",
    "en-CA",
    "en-GB",
    "fr-FR",
    "fr-CA",
    "es-ES",
    "es-MX",
    "de-DE",
    "it-IT",
    "ja-JP",
  ];
  for (const [i, locale] of locales.entries()) {
    process.env[`PUBLIC_ENABLED_LOCALES__${i}`] = locale;
  }
});

import {
  SUPPORTED_LOCALES,
  BASE_LOCALE,
  isValidLocale,
  resolveLocale,
  LANGUAGE_DEFAULTS,
  toBcp47,
} from "@d2/i18n";

// ---------------------------------------------------------------------------
// toBcp47
// ---------------------------------------------------------------------------

describe("toBcp47", () => {
  it("normalises lowercase to canonical BCP 47", () => {
    expect(toBcp47("en-us")).toBe("en-US");
    expect(toBcp47("fr-ca")).toBe("fr-CA");
    expect(toBcp47("ja-jp")).toBe("ja-JP");
  });

  it("normalises uppercase to canonical BCP 47", () => {
    expect(toBcp47("EN-US")).toBe("en-US");
    expect(toBcp47("FR-FR")).toBe("fr-FR");
  });

  it("normalises mixed case to canonical BCP 47", () => {
    expect(toBcp47("Fr-Ca")).toBe("fr-CA");
    expect(toBcp47("eS-mX")).toBe("es-MX");
  });

  it("lowercases bare language codes", () => {
    expect(toBcp47("EN")).toBe("en");
    expect(toBcp47("fr")).toBe("fr");
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_LOCALES
// ---------------------------------------------------------------------------

describe("SUPPORTED_LOCALES", () => {
  it("contains all 10 BCP 47 locales from env vars in canonical casing", () => {
    expect(SUPPORTED_LOCALES).toEqual([
      "en-US",
      "en-CA",
      "en-GB",
      "fr-FR",
      "fr-CA",
      "es-ES",
      "es-MX",
      "de-DE",
      "it-IT",
      "ja-JP",
    ]);
  });

  it("is a readonly array", () => {
    expect(Array.isArray(SUPPORTED_LOCALES)).toBe(true);
    expect(SUPPORTED_LOCALES).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// BASE_LOCALE
// ---------------------------------------------------------------------------

describe("BASE_LOCALE", () => {
  it("is 'en-US'", () => {
    expect(BASE_LOCALE).toBe("en-US");
  });
});

// ---------------------------------------------------------------------------
// isValidLocale
// ---------------------------------------------------------------------------

describe("isValidLocale", () => {
  it.each([
    "en-US",
    "en-CA",
    "en-GB",
    "fr-FR",
    "fr-CA",
    "es-ES",
    "es-MX",
    "de-DE",
    "it-IT",
    "ja-JP",
  ])("returns true for '%s'", (locale) => {
    expect(isValidLocale(locale)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidLocale("EN-US")).toBe(true);
    expect(isValidLocale("Fr-Ca")).toBe(true);
    expect(isValidLocale("ja-jp")).toBe(true);
  });

  it.each(["en", "fr", "xx-XX", "", "  ", "english", "zh"])("returns false for '%s'", (locale) => {
    expect(isValidLocale(locale)).toBe(false);
  });

  it("throws for undefined cast to string (no null guard)", () => {
    expect(() => isValidLocale(undefined as unknown as string)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LANGUAGE_DEFAULTS
// ---------------------------------------------------------------------------

describe("LANGUAGE_DEFAULTS", () => {
  it("maps each language prefix to the first locale for that language", () => {
    expect(LANGUAGE_DEFAULTS["en"]).toBe("en-US");
    expect(LANGUAGE_DEFAULTS["fr"]).toBe("fr-FR");
    expect(LANGUAGE_DEFAULTS["es"]).toBe("es-ES");
    expect(LANGUAGE_DEFAULTS["de"]).toBe("de-DE");
    expect(LANGUAGE_DEFAULTS["it"]).toBe("it-IT");
    expect(LANGUAGE_DEFAULTS["ja"]).toBe("ja-JP");
  });

  it("does not contain region-only keys", () => {
    expect(LANGUAGE_DEFAULTS["us"]).toBeUndefined();
    expect(LANGUAGE_DEFAULTS["ca"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveLocale
// ---------------------------------------------------------------------------

describe("resolveLocale", () => {
  it("returns canonical BCP 47 casing for a valid locale", () => {
    expect(resolveLocale("en-US")).toBe("en-US");
    expect(resolveLocale("fr-CA")).toBe("fr-CA");
    expect(resolveLocale("ja-JP")).toBe("ja-JP");
  });

  it("falls back to language default for unknown region", () => {
    expect(resolveLocale("en-AU")).toBe("en-US");
    expect(resolveLocale("fr-CH")).toBe("fr-FR");
    expect(resolveLocale("es-AR")).toBe("es-ES");
  });

  it("falls back to language default for bare language code", () => {
    expect(resolveLocale("en")).toBe("en-US");
    expect(resolveLocale("fr")).toBe("fr-FR");
    expect(resolveLocale("de")).toBe("de-DE");
    expect(resolveLocale("ja")).toBe("ja-JP");
  });

  it("returns BASE_LOCALE for unknown language", () => {
    expect(resolveLocale("xx")).toBe("en-US");
    expect(resolveLocale("zz-ZZ")).toBe("en-US");
  });

  it("returns BASE_LOCALE for null", () => {
    expect(resolveLocale(null)).toBe("en-US");
  });

  it("returns BASE_LOCALE for undefined", () => {
    expect(resolveLocale(undefined)).toBe("en-US");
  });

  it("returns BASE_LOCALE for empty string", () => {
    expect(resolveLocale("")).toBe("en-US");
  });

  it("normalises any casing to canonical BCP 47", () => {
    expect(resolveLocale("EN-US")).toBe("en-US");
    expect(resolveLocale("Fr-Ca")).toBe("fr-CA");
    expect(resolveLocale("JA-JP")).toBe("ja-JP");
  });
});
