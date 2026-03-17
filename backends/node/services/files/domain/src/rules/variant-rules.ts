import type { ContentCategory } from "../enums/content-category.js";
import type { VariantSize } from "../enums/variant-size.js";
import { VARIANT_CONFIGS } from "../constants/files-constants.js";

/**
 * Returns the required variant sizes for a given content category.
 *
 * - image: all 5 variants (thumb, small, medium, large, original)
 * - video: thumb + original only
 * - document, audio: original only
 */
export function getRequiredVariants(category: ContentCategory): readonly VariantSize[] {
  switch (category) {
    case "image":
      return ["thumb", "small", "medium", "large", "original"];
    case "video":
      return ["thumb", "original"];
    case "document":
    case "audio":
      return ["original"];
  }
}

/**
 * Looks up the target dimensions for a variant size.
 */
export function getVariantDimensions(size: VariantSize): { width: number; height: number } {
  return VARIANT_CONFIGS[size];
}

/**
 * Checks whether a variant size requires resizing.
 * Returns true unless the dimensions are 0x0 (original).
 */
export function requiresResize(size: VariantSize): boolean {
  const config = VARIANT_CONFIGS[size];
  return config.width !== 0 || config.height !== 0;
}
