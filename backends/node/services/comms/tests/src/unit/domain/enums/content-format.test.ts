import { describe, it, expect } from "vitest";
import { isValidContentFormat } from "@d2/comms-domain";

describe("ContentFormat", () => {
  describe("isValidContentFormat", () => {
    it.each(["markdown", "plain", "html"])("should return true for valid format '%s'", (format) => {
      expect(isValidContentFormat(format)).toBe(true);
    });

    it.each(["Markdown", "HTML", "richtext", "rtf", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidContentFormat(value)).toBe(false);
      },
    );
  });
});
