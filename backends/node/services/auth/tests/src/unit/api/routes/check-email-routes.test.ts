import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { D2Result } from "@d2/result";
import { createCheckEmailRoutes } from "@d2/auth-api";

function createMockHandler(available = true) {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { available } })),
  };
}

function createApp(handler: ReturnType<typeof createMockHandler>) {
  const app = new Hono();
  app.route("/", createCheckEmailRoutes(handler as any));
  return app;
}

describe("check-email routes", () => {
  // -----------------------------------------------------------------------
  // Missing email parameter
  // -----------------------------------------------------------------------

  it("returns 400 when email query param is missing", async () => {
    const handler = createMockHandler();
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.messages).toContain("Email query parameter is required.");
    expect(handler.handleAsync).not.toHaveBeenCalled();
  });

  it("returns 400 when email query param is empty string", async () => {
    const handler = createMockHandler();
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=");
    const body = await res.json();

    // Empty string is falsy, so the route should still reject
    expect(res.status).toBe(400);
    expect(handler.handleAsync).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it("returns 200 with available=true for new email", async () => {
    const handler = createMockHandler(true);
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=new@test.com");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(true);
    expect(handler.handleAsync).toHaveBeenCalledWith({ email: "new@test.com" });
  });

  it("returns 200 with available=false for taken email", async () => {
    const handler = createMockHandler(false);
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=taken@test.com");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.available).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Handler error propagation
  // -----------------------------------------------------------------------

  it("returns handler status code when handler fails", async () => {
    const handler = createMockHandler();
    handler.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({ messages: ["Invalid email"], statusCode: 400 }),
    );
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=bad");
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.messages).toContain("Invalid email");
  });

  it("defaults to 400 when handler fails without statusCode", async () => {
    const handler = createMockHandler();
    handler.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({ messages: ["Unknown error"] }),
    );
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=bad@test.com");

    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------------------
  // URL encoding
  // -----------------------------------------------------------------------

  it("handles URL-encoded email correctly", async () => {
    const handler = createMockHandler(true);
    const app = createApp(handler);

    const res = await app.request(
      "/api/auth/check-email?email=user%2Btag%40example.com",
    );

    expect(res.status).toBe(200);
    expect(handler.handleAsync).toHaveBeenCalledWith({ email: "user+tag@example.com" });
  });

  // -----------------------------------------------------------------------
  // HTTP method
  // -----------------------------------------------------------------------

  it("only responds to GET requests", async () => {
    const handler = createMockHandler();
    const app = createApp(handler);

    const res = await app.request("/api/auth/check-email?email=test@test.com", {
      method: "POST",
    });

    expect(res.status).toBe(404);
    expect(handler.handleAsync).not.toHaveBeenCalled();
  });
});
