import { trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";
import { OTEL_SPAN_KEY, type OTelIncomingMessage } from "./setup-telemetry.js";

type SpanValue = string | number | boolean | undefined | null;

/**
 * Retrieves the OTel HTTP server span from within a Hono middleware context.
 *
 * `@hono/node-server` doesn't propagate the OTel async context into Hono's
 * middleware chain, so `trace.getActiveSpan()` returns null. This helper
 * reads the span stashed on `IncomingMessage` by the HTTP instrumentation's
 * `requestHook` (configured in setup-telemetry.ts).
 *
 * Falls back to `trace.getActiveSpan()` for environments where async context
 * propagation works correctly (e.g. tests, other adapters).
 *
 * @param c - Hono context object (c.env.incoming contains the raw Node.js IncomingMessage)
 */
export function getServerSpan(c: { env?: unknown }): Span | undefined {
  // Primary: read from IncomingMessage stashed by HTTP instrumentation requestHook
  const env = c.env as Record<string, unknown> | undefined;
  const incoming = env?.incoming as OTelIncomingMessage | undefined;
  const stashedSpan = incoming?.[OTEL_SPAN_KEY];
  if (stashedSpan) return stashedSpan;

  // Fallback: standard OTel active span (works when async context propagates)
  return trace.getActiveSpan() ?? undefined;
}

/**
 * Sets non-null/undefined values as span attributes in bulk.
 * Eliminates repetitive `if (value) span.setAttribute(...)` blocks.
 *
 * Usage:
 * ```ts
 * enrichSpan(span, {
 *   userId: requestContext.userId,
 *   username: requestContext.username,
 *   isAuthenticated: requestContext.isAuthenticated ?? false,
 * });
 * ```
 */
export function enrichSpan(span: Span | undefined, attrs: Record<string, SpanValue>): void {
  if (!span) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) {
      span.setAttribute(key, value);
    }
  }
}
