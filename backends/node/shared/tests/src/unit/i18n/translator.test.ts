import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "node:path";
import { createTranslator, type Translator } from "@d2/i18n";

// Path from shared/tests/src/unit/i18n/ → contracts/messages/
const messagesDir = resolve(import.meta.dirname, "../../../../../../../contracts/messages");

describe("createTranslator", () => {
  let translator: Translator;

  beforeAll(() => {
    translator = createTranslator({ messagesDir });
  });

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  it("loads all supported locales in canonical BCP 47 casing", () => {
    expect(translator.locales).toContain("en-US");
    expect(translator.locales).toContain("es-ES");
    expect(translator.locales).toContain("de-DE");
    expect(translator.locales).toContain("fr-FR");
    expect(translator.locales).toContain("ja-JP");
    expect(translator.locales).toContain("en-CA");
    expect(translator.locales).toContain("en-GB");
    expect(translator.locales).toContain("es-MX");
    expect(translator.locales).toContain("fr-CA");
    expect(translator.locales).toContain("it-IT");
  });

  it("locales list is frozen", () => {
    expect(Object.isFrozen(translator.locales)).toBe(true);
  });

  it("has 'en-US' as base locale by default", () => {
    expect(translator.baseLocale).toBe("en-US");
  });

  it("throws when base locale file is missing", () => {
    expect(() => createTranslator({ messagesDir, baseLocale: "xx" })).toThrow(
      /Base locale "xx" not found/,
    );
  });

  it("throws when messages directory does not exist", () => {
    expect(() => createTranslator({ messagesDir: "/nonexistent/path" })).toThrow();
  });

  // ---------------------------------------------------------------------------
  // Basic translation (base locale)
  // ---------------------------------------------------------------------------

  it("translates a known key in the base locale", () => {
    const result = translator.t("en-US", "common_ui_save");
    expect(result).toBe("Save");
  });

  it("translates a known key in a non-base locale", () => {
    const result = translator.t("es-ES", "common_ui_save");
    expect(result).toBe("Guardar");
  });

  it("translates into German", () => {
    expect(translator.t("de-DE", "common_ui_cancel")).toBe("Abbrechen");
  });

  it("translates into French", () => {
    expect(translator.t("fr-FR", "common_ui_cancel")).toBe("Annuler");
  });

  it("translates into Japanese", () => {
    expect(translator.t("ja-JP", "common_ui_cancel")).toBe("キャンセル");
  });

  // ---------------------------------------------------------------------------
  // Fallback behavior
  // ---------------------------------------------------------------------------

  it("falls back to base locale when key is missing in requested locale", () => {
    const result = translator.t("en-US", "common_ui_save");
    expect(result).toBe("Save");
  });

  it("falls back to base locale for unknown locale", () => {
    const result = translator.t("xx", "common_ui_save");
    expect(result).toBe("Save");
  });

  it("returns the key itself when key is unknown in all locales", () => {
    const result = translator.t("en-US", "this_key_does_not_exist");
    expect(result).toBe("this_key_does_not_exist");
  });

  it("returns the key itself for unknown locale AND unknown key", () => {
    const result = translator.t("xx", "nonexistent_key");
    expect(result).toBe("nonexistent_key");
  });

  // ---------------------------------------------------------------------------
  // Interpolation
  // ---------------------------------------------------------------------------

  it("interpolates a single parameter", () => {
    const result = translator.t("en-US", "auth_email_verification_greeting", {
      name: "Alice",
    });
    expect(result).toBe("Hi Alice,");
  });

  it("interpolates multiple parameters", () => {
    const result = translator.t("en-US", "auth_email_verification_plaintext", {
      name: "Bob",
      url: "https://example.com/verify",
    });
    expect(result).toContain("Bob");
    expect(result).toContain("https://example.com/verify");
  });

  it("interpolates parameters in non-English locale", () => {
    const result = translator.t("de-DE", "auth_email_verification_greeting", {
      name: "Hans",
    });
    expect(result).toBe("Hallo Hans,");
  });

  it("interpolates in Japanese locale", () => {
    const result = translator.t("ja-JP", "auth_email_verification_greeting", {
      name: "太郎",
    });
    expect(result).toContain("太郎");
  });

  it("leaves placeholder intact when param is not provided", () => {
    const result = translator.t("en-US", "auth_email_verification_greeting", {});
    expect(result).toBe("Hi {name},");
  });

  it("returns message unchanged when no params are needed and none provided", () => {
    const result = translator.t("en-US", "common_ui_save");
    expect(result).toBe("Save");
  });

  it("ignores extra params that are not in the message", () => {
    const result = translator.t("en-US", "common_ui_save", { extra: "ignored" });
    expect(result).toBe("Save");
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it("handles empty string locale gracefully (falls back)", () => {
    const result = translator.t("", "common_ui_save");
    expect(result).toBe("Save");
  });

  it("handles empty string key (returns empty string — no match)", () => {
    const result = translator.t("en-US", "");
    expect(result).toBe("");
  });

  it("does not strip $schema key from catalog", () => {
    // $schema is stripped during loading — verify it's not accessible as a message
    const result = translator.t("en-US", "$schema");
    expect(result).toBe("$schema");
  });
});
