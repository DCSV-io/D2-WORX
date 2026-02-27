/**
 * Escapes HTML special characters to prevent XSS in HTML content.
 *
 * Replaces &, <, >, ", and ' with their HTML entity equivalents.
 * Use this for any user-provided string interpolated into HTML bodies.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
