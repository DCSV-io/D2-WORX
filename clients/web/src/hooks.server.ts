import "./instrumentation.server"; // Initialize instrumentation...
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { paraglideMiddleware } from "$lib/paraglide/server";
import { requestLogger } from "$lib/server/request-logger.server";
import { logger } from "$lib/server/logger.server";

const handleParaglide: Handle = async ({ event, resolve }) => {
  try {
    requestLogger.info(event, "Request received.", {
      method: event.request.method,
      url: event.url.pathname,
      userAgent: event.request.headers.get("user-agent"),
    });

    const response = await paraglideMiddleware(event.request, ({ request, locale }) => {
      event.request = request;

      return resolve(event, {
        transformPageChunk: ({ html }) => html.replace("%paraglide.lang%", locale),
      });
    });

    requestLogger.info(event, "Request completed.", {
      status: response.status,
      url: event.url.pathname,
    });

    return response;
  } catch (error) {
    requestLogger.error(event, "Request failed", {
      error: error,
      url: event.url.pathname,
    });

    return await resolve(event);
  }
};

export const handle: Handle = handleParaglide;

export const handleError: HandleServerError = async ({ error, status, message }) => {
  const traceId = crypto.randomUUID();

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error("Server-side error", {
    error_message: errorMessage,
    error_stack: errorStack,
    error_status: status,
    error_trace_id: traceId,
  });

  return {
    message,
    traceId,
  };
};
