/**
 * Format of message content.
 *
 * - `markdown` — default, rendered by clients
 * - `plain` — plain text, no formatting
 * - `html` — pre-rendered HTML (e.g., from rich text editor)
 */

export const CONTENT_FORMATS = ["markdown", "plain", "html"] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export function isValidContentFormat(value: unknown): value is ContentFormat {
  return typeof value === "string" && CONTENT_FORMATS.includes(value as ContentFormat);
}
