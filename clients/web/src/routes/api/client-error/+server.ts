import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { logger } from "$lib/server/logger.server";

interface ClientErrorPayload {
  message: string;
  stack?: string;
  status: number;
  traceId: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

const MAX_PAYLOAD_SIZE = 8192;

export const POST: RequestHandler = async ({ request }) => {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
    return json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: ClientErrorPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.message || typeof payload.message !== "string") {
    return json({ error: "Missing or invalid 'message' field" }, { status: 400 });
  }

  if (!payload.traceId || typeof payload.traceId !== "string") {
    return json({ error: "Missing or invalid 'traceId' field" }, { status: 400 });
  }

  logger.error("Client-side error", {
    client_error_message: payload.message.slice(0, 2000),
    client_error_stack: payload.stack?.slice(0, 4000),
    client_error_status: payload.status,
    client_error_trace_id: payload.traceId,
    client_error_url: payload.url?.slice(0, 500),
    client_error_user_agent: payload.userAgent?.slice(0, 500),
    client_error_timestamp: payload.timestamp,
  });

  return json({ received: true });
};
