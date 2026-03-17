/**
 * Standard image processing variant sizes.
 *
 * - `thumb` — 64x64 thumbnail
 * - `small` — 128x128
 * - `medium` — 512x512
 * - `large` — 1024x1024
 * - `original` — unmodified (0x0 = no resize)
 */

export const VARIANT_SIZES = ["thumb", "small", "medium", "large", "original"] as const;

export type VariantSize = (typeof VARIANT_SIZES)[number];

export function isValidVariantSize(value: unknown): value is VariantSize {
  return typeof value === "string" && VARIANT_SIZES.includes(value as VariantSize);
}
