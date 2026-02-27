import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { D2Result, HttpStatusCode } from "@d2/result";
import { AuthValidationError } from "@d2/auth-domain";

/**
 * Global error handler that catches unhandled exceptions and returns
 * a D2Result-shaped JSON response.
 *
 * Security: Only surfaces error details for known validation errors (4xx).
 * For 5xx/unknown errors, returns a generic message to prevent information leakage
 * (SQL details, file paths, internal state).
 */
export function handleError(err: Error, c: Context): Response {
  // Record error on the active OTel span (no-op if no provider registered).
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  }

  const rawStatus = "status" in err && typeof err.status === "number" ? err.status : 500;

  // For validation errors, provide structured error details
  if (err instanceof AuthValidationError) {
    const result = D2Result.fail({
      messages: [`Validation failed: ${err.propertyName} is invalid.`],
      statusCode: HttpStatusCode.BadRequest,
    });
    return c.json(result, 400 as ContentfulStatusCode);
  }

  // For 4xx client errors, provide a safe message
  if (rawStatus >= 400 && rawStatus < 500) {
    const result = D2Result.fail({
      messages: [safeClientMessage(rawStatus)],
      statusCode: rawStatus as HttpStatusCode,
    });
    return c.json(result, rawStatus as ContentfulStatusCode);
  }

  // For 5xx server errors, NEVER leak err.message — use generic message
  const result = D2Result.fail({
    messages: ["An unexpected error occurred. Please try again later."],
    statusCode: HttpStatusCode.InternalServerError,
  });
  return c.json(result, 500 as ContentfulStatusCode);
}

function safeClientMessage(status: number): string {
  switch (status) {
    case 400:
      return "Bad request.";
    case 401:
      return "Authentication required.";
    case 403:
      return "Access denied.";
    case 404:
      return "Resource not found.";
    case 409:
      return "Conflict.";
    case 429:
      return "Too many requests. Please slow down.";
    default:
      return "Request failed.";
  }
}
