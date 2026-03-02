import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the logger before importing the module
vi.mock("$lib/server/logger.server", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("POST /api/client-error", () => {
  let POST: (args: { request: Request }) => Promise<Response>;
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./+server");
    POST = mod.POST as unknown as (args: { request: Request }) => Promise<Response>;
    const loggerMod = await import("$lib/server/logger.server");
    mockLogger = loggerMod.logger as unknown as { error: ReturnType<typeof vi.fn> };
  });

  function makeRequest(body: unknown, headers?: Record<string, string>): Request {
    return new Request("http://localhost/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  it("accepts a valid client error payload", async () => {
    const payload = {
      message: "Uncaught TypeError: x is not a function",
      stack: "TypeError: x is not a function\n    at foo.js:1:1",
      status: 500,
      traceId: "abc-123",
      url: "http://localhost:5173/dashboard",
      userAgent: "Mozilla/5.0",
      timestamp: "2026-03-01T00:00:00.000Z",
    };

    const response = await POST({ request: makeRequest(payload) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ received: true });
    expect(mockLogger.error).toHaveBeenCalledWith("Client-side error", expect.objectContaining({
      client_error_message: payload.message,
      client_error_trace_id: payload.traceId,
    }));
  });

  it("rejects invalid JSON", async () => {
    const request = new Request("http://localhost/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST({ request });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("rejects missing message field", async () => {
    const response = await POST({ request: makeRequest({ traceId: "abc" }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("message");
  });

  it("rejects missing traceId field", async () => {
    const response = await POST({ request: makeRequest({ message: "error" }) });
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("traceId");
  });

  it("rejects oversized payloads", async () => {
    const payload = { message: "x", traceId: "y" };
    const response = await POST({
      request: makeRequest(payload, { "content-length": "10000" }),
    });
    expect(response.status).toBe(413);
  });

  it("truncates excessively long fields", async () => {
    const payload = {
      message: "a".repeat(5000),
      traceId: "abc-123",
      status: 500,
      url: "http://localhost/" + "x".repeat(1000),
      userAgent: "UA " + "y".repeat(1000),
      timestamp: new Date().toISOString(),
    };

    await POST({ request: makeRequest(payload) });

    expect(mockLogger.error).toHaveBeenCalledWith("Client-side error", expect.objectContaining({
      client_error_message: expect.any(String),
    }));

    const logCall = mockLogger.error.mock.calls[0][1];
    expect(logCall.client_error_message.length).toBeLessThanOrEqual(2000);
    expect(logCall.client_error_url.length).toBeLessThanOrEqual(500);
    expect(logCall.client_error_user_agent.length).toBeLessThanOrEqual(500);
  });
});
