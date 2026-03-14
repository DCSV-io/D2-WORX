import type { Translator } from "@d2/i18n";

/**
 * Translates D2Result message keys and input error keys to localized text.
 *
 * D2Result shape: `{ statusCode, messages?: string[], inputErrors?: string[][], ... }`
 *
 * Translation targets:
 * - `messages[]` — each string is translated if the translator recognizes it.
 * - `inputErrors[]` — each sub-array is `[fieldName, error1, error2, ...]`.
 *   Index 0 (field name) is preserved; index 1+ entries are translated.
 *
 * @param body - The parsed response body (any JSON value)
 * @param locale - The resolved locale code
 * @param translator - The translator instance
 * @returns The translated body if it looks like a D2Result, otherwise the original body
 */
export function translateD2Result(body: unknown, locale: string, translator: Translator): unknown {
  if (!isD2Result(body)) {
    return body;
  }

  const result = { ...body } as Record<string, unknown>;

  // Translate messages
  if (Array.isArray(result["messages"])) {
    result["messages"] = (result["messages"] as unknown[]).map((msg) => {
      if (typeof msg !== "string") return msg;
      return translator.t(locale, msg);
    });
  }

  // Translate input errors (skip field name at index 0)
  if (Array.isArray(result["inputErrors"])) {
    result["inputErrors"] = (result["inputErrors"] as unknown[]).map((errorGroup) => {
      if (!Array.isArray(errorGroup)) return errorGroup;
      return errorGroup.map((item: unknown, i: number) => {
        if (typeof item !== "string") return item;
        return i > 0 ? translator.t(locale, item) : item;
      });
    });
  }

  return result;
}

/**
 * Type guard: checks if value looks like a D2Result (has statusCode property).
 */
function isD2Result(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && "statusCode" in value;
}
