import type { HandleClientError } from "@sveltejs/kit";

export const handleError: HandleClientError = async ({ error, status, message }) => {
  const traceId = crypto.randomUUID();

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[Client Error] ${status}: ${errorMessage}`, { traceId });

  try {
    await fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: errorMessage,
        stack: errorStack,
        status,
        traceId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Silently fail — don't create error loops
  }

  return {
    message,
    traceId,
  };
};
