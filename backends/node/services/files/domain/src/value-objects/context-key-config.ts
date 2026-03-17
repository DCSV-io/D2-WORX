import type { ContentCategory } from "../enums/content-category.js";

/**
 * Per-context-key configuration for file uploads.
 *
 * Used by app/infra layers to define allowed categories and size limits
 * for each context key. Type-only — no factory, no persistence.
 */
export interface ContextKeyConfig {
  readonly contextKey: string;
  readonly allowedCategories: readonly ContentCategory[];
  readonly maxSizeBytes: number;
}
