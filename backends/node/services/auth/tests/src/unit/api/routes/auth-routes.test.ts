import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { D2Result } from "@d2/result";
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

/** Mock throttle handlers matching { check, record } shape. */
function createMockThrottleHandlers(
  checkResult: { blocked: boolean; retryAfterSec?: number } = { blocked: false },
) {
  return {
    check: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: checkResult })),
    },
    record: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { recorded: true } })),
    },
  };
}

type MockThrottle = ReturnType<typeof createMockThrottleHandlers>;

/**
 * Creates a Hono app with optional enrichment middleware that sets requestInfo,
 * mirroring the production composition root's middleware stack.
 */
function createApp(
  mockAuth: any,
  throttle?: MockThrottle,
  requestInfo?: { clientIp?: string; serverFingerprint?: string },
) {
  const app = new Hono();
  // Simulate request enrichment middleware (runs on parent app in production)
  if (requestInfo) {
    app.use("*", async (c, next) => {
      c.set("requestInfo" as never, requestInfo as never);
      await next();
    });
  }
  app.route("/", createAuthRoutes(mockAuth, throttle as any));
  return app;
}

function postJson(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Auth routes", () => {
  // -----------------------------------------------------------------------
  // Existing Cache-Control tests
  // -----------------------------------------------------------------------

  describe("Cache-Control on .well-known responses", () => {
    it("should add Cache-Control header for .well-known/openid-configuration", async () => {
      const mockAuth = createMockAuth('{"issuer":"https://auth.example.com"}');
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/.well-known/openid-configuration");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should add Cache-Control header for .well-known/jwks.json", async () => {
      const mockAuth = createMockAuth('{"keys":[]}');
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });

    it("should preserve original response body for .well-known", async () => {
      const body = '{"keys":[{"kty":"RSA"}]}';
      const mockAuth = createMockAuth(body);
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(await res.text()).toBe(body);
    });

    it("should preserve original response status for .well-known", async () => {
      const mockAuth = createMockAuth("not found", 404);
      const app = createApp(mockAuth);

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
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/.well-known/jwks.json");

      expect(res.headers.get("X-Custom")).toBe("preserved");
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600");
    });
  });

  describe("Non-.well-known responses", () => {
    it("should NOT add Cache-Control header for sign-in endpoint", async () => {
      const mockAuth = createMockAuth('{"session":"abc"}');
      const app = createApp(mockAuth);

      const res = await app.request(
        postJson("/api/auth/sign-in/email", { email: "a@b.com", password: "x" }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("should NOT add Cache-Control header for session endpoint", async () => {
      const mockAuth = createMockAuth('{"user":"test"}');
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/get-session");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });

    it("should NOT add Cache-Control header for token endpoint", async () => {
      const mockAuth = createMockAuth('{"token":"jwt-here"}');
      const app = createApp(mockAuth);

      const res = await app.request("/api/auth/token");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBeNull();
    });
  });

  describe("Handler delegation", () => {
    it("should pass raw request to auth.handler", async () => {
      const mockAuth = createMockAuth();
      const app = createApp(mockAuth);

      await app.request("/api/auth/get-session");

      expect(mockAuth.handler).toHaveBeenCalledOnce();
      expect(mockAuth.handler).toHaveBeenCalledWith(expect.any(Request));
    });
  });

  // -----------------------------------------------------------------------
  // Sign-in throttle tests
  // -----------------------------------------------------------------------

  describe("Sign-in throttle guard", () => {
    let mockAuth: ReturnType<typeof createMockAuth>;

    beforeEach(() => {
      mockAuth = createMockAuth('{"session":"token-123"}', 200);
    });

    describe("when throttle is blocked", () => {
      it("should return 429 with Retry-After header for /sign-in/email", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 30 });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "secret" }),
        );

        expect(res.status).toBe(429);
        expect(res.headers.get("Retry-After")).toBe("30");
        const body = await res.json();
        expect(body.errorCode).toBe("SIGN_IN_THROTTLED");
      });

      it("should return 429 with Retry-After header for /sign-in/username", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 60 });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/username", { username: "jdoe", password: "secret" }),
        );

        expect(res.status).toBe(429);
        expect(res.headers.get("Retry-After")).toBe("60");
      });

      it("should NOT call auth.handler when blocked", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 5 });
        const app = createApp(mockAuth, throttle);

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "x" }),
        );

        expect(mockAuth.handler).not.toHaveBeenCalled();
      });

      it("should default retryAfterSec to 300 when not provided", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "x" }),
        );

        expect(res.headers.get("Retry-After")).toBe("300");
      });
    });

    describe("when throttle allows", () => {
      it("should forward to auth.handler and return its response", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "secret" }),
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('{"session":"token-123"}');
        expect(mockAuth.handler).toHaveBeenCalledOnce();
      });

      it("should call record with the response status (fire-and-forget)", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle);

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "secret" }),
        );

        // Wait a tick for fire-and-forget to execute
        await new Promise((r) => setTimeout(r, 10));

        expect(throttle.record.handleAsync).toHaveBeenCalledOnce();
        expect(throttle.record.handleAsync).toHaveBeenCalledWith(
          expect.objectContaining({ responseStatus: 200 }),
        );
      });

      it("should record auth.handler's actual status on failure", async () => {
        mockAuth = createMockAuth('{"error":"invalid"}', 401);
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "wrong" }),
        );

        expect(res.status).toBe(401);
        await new Promise((r) => setTimeout(r, 10));
        expect(throttle.record.handleAsync).toHaveBeenCalledWith(
          expect.objectContaining({ responseStatus: 401 }),
        );
      });

      it("should pass correct hashed identifiers to check handler", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle, {
          clientIp: "1.2.3.4",
          serverFingerprint: "fp-abc",
        });

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "User@Example.COM", password: "x" }),
        );

        const checkCall = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
        // Email should be lowercased before hashing
        expect(checkCall.identifierHash).toHaveLength(64); // SHA-256 hex
        expect(checkCall.identityHash).toHaveLength(64);
      });

      it("should lowercase email before hashing", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle);

        // Send two requests with same email in different cases
        await app.request(
          postJson("/api/auth/sign-in/email", { email: "USER@EXAMPLE.COM", password: "x" }),
        );
        const hash1 = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0]
          .identifierHash;

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "x" }),
        );
        const hash2 = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock.calls[1][0]
          .identifierHash;

        expect(hash1).toBe(hash2);
      });
    });

    describe("when no throttle handlers provided", () => {
      it("should pass through directly to auth.handler", async () => {
        const app = createApp(mockAuth); // no throttle

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@example.com", password: "x" }),
        );

        expect(res.status).toBe(200);
        expect(mockAuth.handler).toHaveBeenCalledOnce();
      });
    });

    describe("edge cases", () => {
      it("should fall through when body is not valid JSON", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 5 });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          new Request("http://localhost/api/auth/sign-in/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not-json",
          }),
        );

        // Falls through to auth.handler since body parse fails → identifier undefined
        expect(res.status).toBe(200);
        expect(mockAuth.handler).toHaveBeenCalledOnce();
        expect(throttle.check.handleAsync).not.toHaveBeenCalled();
      });

      it("should fall through when email field is missing from body", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 5 });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { password: "x" }), // no email
        );

        expect(res.status).toBe(200);
        expect(mockAuth.handler).toHaveBeenCalledOnce();
        expect(throttle.check.handleAsync).not.toHaveBeenCalled();
      });

      it("should fall through when username field is missing from body", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 5 });
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/username", { password: "x" }), // no username
        );

        expect(res.status).toBe(200);
        expect(throttle.check.handleAsync).not.toHaveBeenCalled();
      });

      it("should use 'unknown' for IP/fingerprint when requestInfo is not set", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle); // no requestInfo middleware

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@test.com", password: "x" }),
        );

        // Should still call check — uses fallback "unknown:unknown" for identity
        expect(throttle.check.handleAsync).toHaveBeenCalledOnce();
      });

      it("should swallow record handler errors without affecting response", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        (throttle.record.handleAsync as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Redis down"),
        );
        const app = createApp(mockAuth, throttle);

        const res = await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@test.com", password: "x" }),
        );

        // Response should still be 200 from auth.handler
        expect(res.status).toBe(200);
      });

      it("should not throttle non-sign-in auth routes", async () => {
        const throttle = createMockThrottleHandlers({ blocked: true, retryAfterSec: 5 });
        const app = createApp(mockAuth, throttle);

        // sign-up goes through the catch-all, not the throttle guard
        const res = await app.request(
          postJson("/api/auth/sign-up/email", { email: "new@user.com", password: "x" }),
        );

        expect(res.status).toBe(200);
        expect(throttle.check.handleAsync).not.toHaveBeenCalled();
      });

      it("should use username (not email) for /sign-in/username path", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle);

        // Send both username and email — only username should be used for the hash
        await app.request(
          postJson("/api/auth/sign-in/username", {
            username: "jdoe",
            email: "ignored@test.com",
            password: "x",
          }),
        );

        // Also send the same username via the email path for comparison
        await app.request(postJson("/api/auth/sign-in/email", { email: "jdoe", password: "x" }));

        const usernameCall = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        const emailCall = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock.calls[1][0];

        // Username path should hash "jdoe", email path should also hash "jdoe"
        // → same identifierHash proves username path used "jdoe" (not "ignored@test.com")
        expect(usernameCall.identifierHash).toBe(emailCall.identifierHash);
        expect(usernameCall.identifierHash).toHaveLength(64);
      });
    });

    describe("requestInfo propagation from parent middleware", () => {
      it("should use clientIp and serverFingerprint from enrichment middleware", async () => {
        const throttle = createMockThrottleHandlers({ blocked: false });
        const app = createApp(mockAuth, throttle, {
          clientIp: "203.0.113.42",
          serverFingerprint: "sha256-fp-value",
        });

        await app.request(
          postJson("/api/auth/sign-in/email", { email: "user@test.com", password: "x" }),
        );

        // Both check and record should receive the same hashes
        const checkCall = (throttle.check.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
        await new Promise((r) => setTimeout(r, 10));
        const recordCall = (throttle.record.handleAsync as ReturnType<typeof vi.fn>).mock
          .calls[0][0];

        expect(checkCall.identityHash).toBe(recordCall.identityHash);
        expect(checkCall.identifierHash).toBe(recordCall.identifierHash);
      });
    });
  });
});
