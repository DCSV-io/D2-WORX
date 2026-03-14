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

import { translateD2Result, resolveRequestLocale } from "@d2/translation";
import type { Translator } from "@d2/i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTranslator(translations: Record<string, string> = {}): Translator {
  return {
    t: (_locale: string, key: string) => translations[key] ?? key,
    locales: ["en-US", "es-ES", "fr-FR"],
    baseLocale: "en-US",
  };
}

// ---------------------------------------------------------------------------
// translateD2Result
// ---------------------------------------------------------------------------

describe("translateD2Result", () => {
  it("translates D2Result messages with known keys", () => {
    const translator = createMockTranslator({
      common_errors_not_found: "Not found",
      common_errors_unauthorized: "Unauthorized",
    });
    const body = {
      statusCode: 404,
      messages: ["common_errors_not_found", "common_errors_unauthorized"],
    };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["messages"]).toEqual(["Not found", "Unauthorized"]);
  });

  it("leaves unknown keys unchanged", () => {
    const translator = createMockTranslator({ known_key: "Translated" });
    const body = { statusCode: 400, messages: ["unknown_key_xyz"] };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["messages"]).toEqual(["unknown_key_xyz"]);
  });

  it("translates inputErrors (skipping field name at index 0)", () => {
    const translator = createMockTranslator({
      validation_required: "This field is required",
      validation_too_long: "Too long",
    });
    const body = {
      statusCode: 400,
      inputErrors: [
        ["email", "validation_required"],
        ["name", "validation_too_long"],
      ],
    };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["inputErrors"]).toEqual([
      ["email", "This field is required"],
      ["name", "Too long"],
    ]);
  });

  it("handles mixed known and unknown keys in messages", () => {
    const translator = createMockTranslator({ known: "Known Translation" });
    const body = { statusCode: 500, messages: ["known", "not_in_catalog", "known"] };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["messages"]).toEqual([
      "Known Translation",
      "not_in_catalog",
      "Known Translation",
    ]);
  });

  it("handles mixed known and unknown keys in inputErrors", () => {
    const translator = createMockTranslator({ err_required: "Required" });
    const body = {
      statusCode: 400,
      inputErrors: [["field1", "err_required", "unknown_err"]],
    };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["inputErrors"]).toEqual([["field1", "Required", "unknown_err"]]);
  });

  it("passes through non-D2Result objects unchanged", () => {
    const translator = createMockTranslator();
    const body = { someField: "value", nested: { deep: true } };

    const result = translateD2Result(body, "en-us", translator);

    expect(result).toEqual(body);
  });

  it("passes through null unchanged", () => {
    const translator = createMockTranslator();

    expect(translateD2Result(null, "en-us", translator)).toBeNull();
  });

  it("passes through undefined unchanged", () => {
    const translator = createMockTranslator();

    expect(translateD2Result(undefined, "en-us", translator)).toBeUndefined();
  });

  it("passes through primitive values unchanged", () => {
    const translator = createMockTranslator();

    expect(translateD2Result(42, "en-us", translator)).toBe(42);
    expect(translateD2Result("hello", "en-us", translator)).toBe("hello");
    expect(translateD2Result(true, "en-us", translator)).toBe(true);
  });

  it("handles empty messages array", () => {
    const translator = createMockTranslator();
    const body = { statusCode: 200, messages: [] };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["messages"]).toEqual([]);
  });

  it("handles empty inputErrors array", () => {
    const translator = createMockTranslator();
    const body = { statusCode: 400, inputErrors: [] };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["inputErrors"]).toEqual([]);
  });

  it("preserves other D2Result fields (data, statusCode, errorCode)", () => {
    const translator = createMockTranslator({ msg_key: "Translated" });
    const body = {
      statusCode: 200,
      errorCode: "NONE",
      data: { id: 1, name: "test" },
      messages: ["msg_key"],
    };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["statusCode"]).toBe(200);
    expect(result["errorCode"]).toBe("NONE");
    expect(result["data"]).toEqual({ id: 1, name: "test" });
    expect(result["messages"]).toEqual(["Translated"]);
  });

  it("handles nested objects in data field", () => {
    const translator = createMockTranslator();
    const body = {
      statusCode: 200,
      data: { users: [{ id: 1, address: { city: "LA" } }] },
      messages: [],
    };

    const result = translateD2Result(body, "en-us", translator) as Record<string, unknown>;

    expect(result["data"]).toEqual({ users: [{ id: 1, address: { city: "LA" } }] });
  });
});

// ---------------------------------------------------------------------------
// resolveRequestLocale
// ---------------------------------------------------------------------------

describe("resolveRequestLocale", () => {
  it("returns resolved locale when D2-Locale is a supported BCP 47 tag", () => {
    expect(resolveRequestLocale("es-ES", undefined)).toBe("es-ES");
  });

  it("resolves bare language code via LANGUAGE_DEFAULTS in D2-Locale", () => {
    expect(resolveRequestLocale("es", undefined)).toBe("es-ES");
    expect(resolveRequestLocale("fr", undefined)).toBe("fr-FR");
  });

  it("returns Accept-Language best match when D2-Locale is absent", () => {
    expect(resolveRequestLocale(undefined, "fr-FR")).toBe("fr-FR");
  });

  it("returns Accept-Language with highest quality weight", () => {
    expect(resolveRequestLocale(undefined, "fr-FR;q=0.5,es-ES;q=0.9,en-US;q=0.8")).toBe("es-ES");
  });

  it("handles Accept-Language exact match for supported locale (fr-CA)", () => {
    // fr-CA is in SUPPORTED_LOCALES, so it matches exactly in the first pass
    expect(resolveRequestLocale(undefined, "fr-CA")).toBe("fr-CA");
  });

  it("handles Accept-Language with unknown region falling back to language default", () => {
    // fr-CH is NOT in SUPPORTED_LOCALES, but fr→fr-FR via LANGUAGE_DEFAULTS
    expect(resolveRequestLocale(undefined, "fr-CH")).toBe("fr-FR");
  });

  it("falls back to BASE_LOCALE when no headers match", () => {
    expect(resolveRequestLocale(undefined, undefined)).toBe("en-US");
  });

  it("resolves unknown D2-Locale to BASE_LOCALE (does not fall to Accept-Language)", () => {
    // D2-Locale is truthy, so resolveLocale("xx") runs and falls back to BASE_LOCALE.
    // Accept-Language is never consulted when D2-Locale is present.
    expect(resolveRequestLocale("xx", "de-DE")).toBe("en-US");
  });

  it("resolves D2-Locale with unknown language to BASE_LOCALE when no Accept-Language", () => {
    expect(resolveRequestLocale("xx", undefined)).toBe("en-US");
  });

  it("normalizes D2-Locale to canonical BCP 47", () => {
    expect(resolveRequestLocale("ES-ES", undefined)).toBe("es-ES");
  });

  it("handles whitespace in D2-Locale", () => {
    expect(resolveRequestLocale("  fr-FR  ", undefined)).toBe("fr-FR");
  });

  it("handles multiple Accept-Language tags with quality weights", () => {
    expect(resolveRequestLocale(undefined, "ja-JP;q=0.3,de-DE;q=0.7,fr-FR;q=0.5")).toBe("de-DE");
  });

  it("handles Accept-Language with q=0 (excluded)", () => {
    // q=0 means "not acceptable", sorts to end. Second tag wins.
    expect(resolveRequestLocale(undefined, "fr-FR;q=0,es-ES;q=0.5")).toBe("es-ES");
  });

  it("handles malformed Accept-Language header", () => {
    // Garbage input — nothing matches, falls back to BASE_LOCALE
    expect(resolveRequestLocale(undefined, ";;;,,,,")).toBe("en-US");
  });

  it("D2-Locale takes priority over Accept-Language", () => {
    expect(resolveRequestLocale("ja-JP", "en-US,es-ES,fr-FR")).toBe("ja-JP");
  });

  it("falls back to BASE_LOCALE when D2-Locale is invalid and Accept-Language has no matches", () => {
    expect(resolveRequestLocale("zz", "xx-YY,zz-QQ")).toBe("en-US");
  });

  it("handles Accept-Language with default quality (implicit q=1)", () => {
    // No q= means q=1.0
    expect(resolveRequestLocale(undefined, "de-DE,en-US;q=0.9")).toBe("de-DE");
  });

  it("handles empty string D2-Locale", () => {
    // Empty string is falsy, should fall through to Accept-Language
    expect(resolveRequestLocale("", "es-ES")).toBe("es-ES");
  });

  it("handles Accept-Language with wildcard *", () => {
    // * is not a valid locale, should be skipped; es-ES matches in first pass
    expect(resolveRequestLocale(undefined, "*,es-ES;q=0.5")).toBe("es-ES");
  });

  it("resolves bare language in Accept-Language via second-pass LANGUAGE_DEFAULTS", () => {
    // "fr" is not a valid locale but has a language default of "fr-FR"
    expect(resolveRequestLocale(undefined, "fr")).toBe("fr-FR");
  });
});
