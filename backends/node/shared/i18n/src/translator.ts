import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BASE_LOCALE, isValidLocale, type SupportedLocale } from "./supported-locales.js";

export interface Translator {
  /** Translate a message key to the given locale, with optional interpolation. */
  t(locale: string, key: string, params?: Record<string, string>): string;
  /** All supported locales loaded at startup. */
  readonly locales: readonly string[];
  /** The base/fallback locale. */
  readonly baseLocale: string;
}

type MessageCatalog = Record<string, Record<string, string>>;

/**
 * Creates a lightweight translator that reads JSON message catalogs
 * from a directory at startup.
 *
 * - Loads all `{locale}.json` files synchronously (they're small)
 * - Supports `{paramName}` interpolation
 * - Falls back to base locale for unknown keys/locales
 */
export function createTranslator(options: {
  /** Absolute path to the directory containing `{locale}.json` files. */
  messagesDir: string;
  /** Base/fallback locale. Defaults to "en". */
  baseLocale?: SupportedLocale;
}): Translator {
  const baseLocale = options.baseLocale ?? BASE_LOCALE;
  const catalogs: MessageCatalog = {};
  const loadedLocales: string[] = [];

  // Load all locale files at startup
  const files = readdirSync(options.messagesDir).filter((f: string) => f.endsWith(".json"));
  for (const file of files) {
    const locale = file.replace(".json", "");
    if (!isValidLocale(locale)) continue;

    const filePath = join(options.messagesDir, file);
    const content = readFileSync(filePath, "utf-8");
    const messages = JSON.parse(content) as Record<string, string>;

    // Strip $schema key if present
    const { $schema: _, ...rest } = messages;
    catalogs[locale] = rest;
    loadedLocales.push(locale);
  }

  if (!catalogs[baseLocale]) {
    throw new Error(`Base locale "${baseLocale}" not found in ${options.messagesDir}`);
  }

  function t(locale: string, key: string, params?: Record<string, string>): string {
    // Try requested locale, fall back to base
    const message = catalogs[locale]?.[key] ?? catalogs[baseLocale]?.[key] ?? key;

    if (!params) return message;

    // Replace {paramName} placeholders
    return message.replace(/\{(\w+)\}/g, (_, paramName: string) => params[paramName] ?? `{${paramName}}`);
  }

  return {
    t,
    locales: Object.freeze(loadedLocales),
    baseLocale,
  };
}
