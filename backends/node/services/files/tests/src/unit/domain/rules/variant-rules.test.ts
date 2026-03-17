import { describe, it, expect } from "vitest";
import { getRequiredVariants, getVariantDimensions, requiresResize } from "@d2/files-domain";

describe("Variant Rules", () => {
  describe("getRequiredVariants", () => {
    it("should return all 5 variants for images", () => {
      const variants = getRequiredVariants("image");
      expect(variants).toHaveLength(5);
      expect(variants).toContain("thumb");
      expect(variants).toContain("small");
      expect(variants).toContain("medium");
      expect(variants).toContain("large");
      expect(variants).toContain("original");
    });

    it("should return thumb and original for video", () => {
      const variants = getRequiredVariants("video");
      expect(variants).toHaveLength(2);
      expect(variants).toContain("thumb");
      expect(variants).toContain("original");
    });

    it("should return original only for documents", () => {
      const variants = getRequiredVariants("document");
      expect(variants).toHaveLength(1);
      expect(variants).toContain("original");
    });

    it("should return original only for audio", () => {
      const variants = getRequiredVariants("audio");
      expect(variants).toHaveLength(1);
      expect(variants).toContain("original");
    });
  });

  describe("getVariantDimensions", () => {
    it("should return 64x64 for thumb", () => {
      expect(getVariantDimensions("thumb")).toEqual({ width: 64, height: 64 });
    });

    it("should return 128x128 for small", () => {
      expect(getVariantDimensions("small")).toEqual({ width: 128, height: 128 });
    });

    it("should return 512x512 for medium", () => {
      expect(getVariantDimensions("medium")).toEqual({ width: 512, height: 512 });
    });

    it("should return 1024x1024 for large", () => {
      expect(getVariantDimensions("large")).toEqual({ width: 1024, height: 1024 });
    });

    it("should return 0x0 for original", () => {
      expect(getVariantDimensions("original")).toEqual({ width: 0, height: 0 });
    });
  });

  describe("requiresResize", () => {
    it.each(["thumb", "small", "medium", "large"] as const)(
      "should return true for '%s'",
      (size) => {
        expect(requiresResize(size)).toBe(true);
      },
    );

    it("should return false for original", () => {
      expect(requiresResize("original")).toBe(false);
    });
  });
});
