import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createAuthRoutes } from "@d2/auth-api";

/**
 * Creates a mock Auth object with a controllable handler function.
 * The handler returns a plain Response, mimicking BetterAuth's handler.
 */
function createMockAuth(responseBody = "ok", responseStatus = 200) {
  return {
    handler: vi.fn().mockResolvedValue(
      new Response(responseBody, {
        status: responseStatus,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  };
}

describe("Auth routes", () => {
  describe("Cache-Control on .well-known responses", () => {
    it("should add Cache-Control header for .well-known/openid-configuration", async () => {
      const mockAuth = createMockAuth('{"issuer":"https://auth.example.com"}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/.well-known/openid-configuration");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should add Cache-Control header for .well-known/jwks.json", async () => {
      const mockAuth = createMockAuth('{"keys":[]}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should preserve original response body for .well-known", async () => {
      const body = '{"keys":[{"kty":"RSA"}]}';
      const mockAuth = createMockAuth(body);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(await res.text()).toBe(body);
    });

    it("should preserve original response status for .well-known", async () => {
      const mockAuth = createMockAuth("not found", 404);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/.well-known/openid-configuration");

      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should preserve original headers for .well-known", async () => {
      const mockAuth = {
        handler: vi.fn().mockResolvedValue(
          new Response("ok", {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Custom": "preserved",
            },
          }),
        ),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(res.headers.get("X-Custom")).toBe("preserved");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });
  });

  describe("Non-.well-known responses", () => {
    it("should NOT add Cache-Control header for sign-in endpoint", async () => {
      const mockAuth = createMockAuth('{"session":"abc"}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/sign-in/email", { method: "POST" });

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("should NOT add Cache-Control header for session endpoint", async () => {
      const mockAuth = createMockAuth('{"user":"test"}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/get-session");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("should NOT add Cache-Control header for token endpoint", async () => {
      const mockAuth = createMockAuth('{"token":"jwt-here"}');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      const res = await app.request("/api/auth/token");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });
  });

  describe("Handler delegation", () => {
    it("should pass raw request to auth.handler", async () => {
      const mockAuth = createMockAuth();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = new Hono().route("/", createAuthRoutes(mockAuth as any));

      await app.request("/api/auth/get-session");

      expect(mockAuth.handler).toHaveBeenCalledOnce();
      expect(mockAuth.handler).toHaveBeenCalledWith(expect.any(Request));
    });
  });
});
