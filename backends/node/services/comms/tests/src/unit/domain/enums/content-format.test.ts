import { describe, it, expect } from "vitest";
import { CONTENT_FORMATS, isValidContentFormat } from "@d2/comms-domain";

describe("ContentFormat", () => {
  it("should have exactly 3 formats", () => {
    expect(CONTENT_FORMATS).toHaveLength(3);
  });

  it("should contain all expected formats", () => {
    expect(CONTENT_FORMATS).toContain("markdown");
    expect(CONTENT_FORMATS).toContain("plain");
    expect(CONTENT_FORMATS).toContain("html");
  });

  describe("isValidContentFormat", () => {
    it.each(["markdown", "plain", "html"])(
      "should return true for valid format '%s'",
      (format) => {
        expect(isValidContentFormat(format)).toBe(true);
      },
    );

    it.each(["Markdown", "HTML", "richtext", "rtf", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidContentFormat(value)).toBe(false);
      },
    );
  });
});
