import { describe, it, expect } from "vitest";
import { VARIANT_SIZES, isValidVariantSize } from "@d2/files-domain";

describe("VariantSize", () => {
  it("should have exactly 5 sizes", () => {
    expect(VARIANT_SIZES).toHaveLength(5);
  });

  it("should contain all expected sizes", () => {
    expect(VARIANT_SIZES).toContain("thumb");
    expect(VARIANT_SIZES).toContain("small");
    expect(VARIANT_SIZES).toContain("medium");
    expect(VARIANT_SIZES).toContain("large");
    expect(VARIANT_SIZES).toContain("original");
  });

  describe("isValidVariantSize", () => {
    it.each(["thumb", "small", "medium", "large", "original"])(
      "should return true for valid size '%s'",
      (size) => {
        expect(isValidVariantSize(size)).toBe(true);
      },
    );

    it.each(["Thumb", "LARGE", "tiny", "xl", "xxl", "", 42, null, undefined, true])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidVariantSize(value)).toBe(false);
      },
    );
  });
});
