import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startContainers,
  stopContainers,
  getAuthPgUrl,
  getAuthPool,
  getGeoPgUrl,
  getRedisUrl,
  getRabbitUrl,
} from "../helpers/containers.js";
import { startGeoService, stopGeoService } from "../helpers/geo-dotnet-service.js";
import {
  startAuthService,
  stopAuthService,
  type AuthServiceHandle,
} from "../helpers/auth-service.js";
import { startAuthHttpServer, type AuthHttpServer } from "../helpers/auth-http-server.js";
import { SessionResolver, JwtManager, AuthProxy } from "@d2/auth-bff-client";
import { createLogger } from "@d2/logging";

const GEO_API_KEY = "e2e-test-key";
const TEST_PASSWORD = "SecurePass123!@#";

/**
 * E2E integration tests for @d2/auth-bff-client.
 *
 * Spins up real infrastructure (PG + Redis + RabbitMQ + .NET Geo), boots
 * the auth service in-process, wraps it in a real HTTP server, then exercises
 * SessionResolver, AuthProxy, and JwtManager over the wire.
 */
describe("E2E: @d2/auth-bff-client integration", () => {
  let geoAddress: string;
  let authHandle: AuthServiceHandle;
  let httpServer: AuthHttpServer;
  const logger = createLogger({ serviceName: "bff-client-e2e" });

  beforeAll(async () => {
    // 1. Start infrastructure containers (PG + RabbitMQ + Redis)
    await startContainers();

    // 2. Start .NET Geo service (needed for sign-up hook: contact creation)
    geoAddress = await startGeoService({
      pgUrl: getGeoPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitUrl: getRabbitUrl(),
      apiKey: GEO_API_KEY,
    });

    // 3. Start auth service in-process
    authHandle = await startAuthService({
      databaseUrl: getAuthPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitMqUrl: getRabbitUrl(),
      geoAddress,
      geoApiKey: GEO_API_KEY,
    });

    // 4. Wrap Hono app in a real HTTP server on ephemeral port
    httpServer = await startAuthHttpServer(authHandle.app);
  }, 180_000);

  afterAll(async () => {
    httpServer?.close();
    await stopAuthService();
    await stopGeoService();
    await stopContainers();
  });

  /**
   * Helper: sign up a user via the in-process BetterAuth API, verify email,
   * then sign in via HTTP to obtain properly signed session cookies.
   *
   * BetterAuth cookie values are signed (TOKEN.SIGNATURE), not raw tokens.
   * The in-process API returns raw tokens (for Bearer auth), but cookie-based
   * session resolution requires the signed format. The only way to get signed
   * cookies is from the HTTP response's set-cookie headers.
   */
  async function signUpAndGetCookie(email: string, name: string): Promise<string> {
    // Sign up via in-process API (fast, no HTTP overhead)
    const signUpRes = await authHandle.auth.api.signUpEmail({
      body: { email, password: TEST_PASSWORD, name },
    });
    expect(signUpRes.user).toBeDefined();

    // Manually verify email (bypasses notification flow)
    await getAuthPool().query('UPDATE "user" SET email_verified = true WHERE id = $1', [
      signUpRes.user.id,
    ]);

    // Sign in via HTTP to get properly signed session cookies
    const signInRes = await fetch(`${httpServer.baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: TEST_PASSWORD }),
    });

    if (!signInRes.ok) {
      throw new Error(`HTTP sign-in failed with status ${signInRes.status}`);
    }

    // Extract set-cookie header (contains signed session_token + session_data)
    const setCookieHeader = signInRes.headers.get("set-cookie");
    if (!setCookieHeader) {
      throw new Error("Sign-in response did not include set-cookie headers");
    }

    // Parse individual cookies from the set-cookie header.
    // Format: "name=value; attrs, name2=value2; attrs"
    // We extract just the "name=value" parts and join them as a cookie header.
    const cookiePairs = setCookieHeader
      .split(/,(?=\s*better-auth\.)/)
      .map((c) => c.split(";")[0].trim());

    return cookiePairs.join("; ");
  }

  // --- SessionResolver ---

  describe("SessionResolver", () => {
    it("should resolve session and user from a valid session cookie", async () => {
      const email = "bff-session-resolve@example.com";
      const cookie = await signUpAndGetCookie(email, "Session Resolve");

      const resolver = new SessionResolver({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/`, {
        headers: { cookie },
      });

      const { session, user } = await resolver.resolve(request);

      expect(session).not.toBeNull();
      expect(session!.userId).toBeTruthy();
      expect(user).not.toBeNull();
      expect(user!.id).toBeTruthy();
      expect(user!.email).toBe(email);
      expect(user!.name).toBe("Session Resolve");

      // Objects should be frozen (edge-case hardening)
      expect(Object.isFrozen(session)).toBe(true);
      expect(Object.isFrozen(user)).toBe(true);
    });

    it("should return null session for an invalid cookie", async () => {
      const resolver = new SessionResolver({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/`, {
        headers: { cookie: "better-auth.session_token=invalid-garbage-value" },
      });

      const { session, user } = await resolver.resolve(request);

      expect(session).toBeNull();
      expect(user).toBeNull();
    });

    it("should return null without making a network call when no cookie is present", async () => {
      const resolver = new SessionResolver({ authServiceUrl: httpServer.baseUrl }, logger);

      // Request with no cookie header at all
      const request = new Request(`${httpServer.baseUrl}/`);

      const { session, user } = await resolver.resolve(request);

      expect(session).toBeNull();
      expect(user).toBeNull();
    });
  });

  // --- AuthProxy ---

  describe("AuthProxy", () => {
    it("should proxy GET /api/auth/get-session with valid cookie and return 200", async () => {
      const email = "bff-proxy-get@example.com";
      const cookie = await signUpAndGetCookie(email, "Proxy Get");

      const proxy = new AuthProxy({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/api/auth/get-session`, {
        method: "GET",
        headers: { cookie },
      });

      const event = {
        request,
        url: new URL(`${httpServer.baseUrl}/api/auth/get-session`),
        locals: {},
      };

      const response = await proxy.proxyRequest(event as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.session).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
    });

    it("should proxy POST /api/auth/sign-in/email and return 200", async () => {
      const email = "bff-proxy-signin@example.com";
      await signUpAndGetCookie(email, "Proxy SignIn");

      const proxy = new AuthProxy({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      });

      const event = {
        request,
        url: new URL(`${httpServer.baseUrl}/api/auth/sign-in/email`),
        locals: {},
      };

      const response = await proxy.proxyRequest(event as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
    });

    it("should proxy sign-in response with set-cookie headers preserved", async () => {
      const email = "bff-proxy-session@example.com";
      await signUpAndGetCookie(email, "Proxy Session");

      const proxy = new AuthProxy({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      });

      const event = {
        request,
        url: new URL(`${httpServer.baseUrl}/api/auth/sign-in/email`),
        locals: {},
      };

      const proxyResponse = await proxy.proxyRequest(event as any);
      const data = await proxyResponse.json();

      // BetterAuth sign-in returns { redirect, token, user } in the body
      expect(data.user).toBeDefined();
      expect(data.user.id).toBeTruthy();
      expect(data.user.email).toBe(email);
      expect(data.token).toBeTruthy();

      // Set-cookie headers should be preserved through the proxy
      const setCookie = proxyResponse.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("better-auth.session_token=");
    });

    it("should produce the same session data as a direct BetterAuth API call", async () => {
      const email = "bff-proxy-match@example.com";
      const cookie = await signUpAndGetCookie(email, "Proxy Match");

      // Direct call to auth service
      const directResponse = await fetch(`${httpServer.baseUrl}/api/auth/get-session`, {
        method: "GET",
        headers: { cookie },
      });
      const directData = await directResponse.json();

      // Proxied call
      const proxy = new AuthProxy({ authServiceUrl: httpServer.baseUrl }, logger);

      const request = new Request(`${httpServer.baseUrl}/api/auth/get-session`, {
        method: "GET",
        headers: { cookie },
      });

      const event = {
        request,
        url: new URL(`${httpServer.baseUrl}/api/auth/get-session`),
        locals: {},
      };

      const proxyResponse = await proxy.proxyRequest(event as any);
      const proxyData = await proxyResponse.json();

      // Both should return the same user
      expect(proxyData.user.id).toBe(directData.user.id);
      expect(proxyData.user.email).toBe(directData.user.email);
      expect(proxyData.session.userId).toBe(directData.session.userId);
    });
  });

  // --- JwtManager ---

  describe("JwtManager", () => {
    it("should obtain a valid RS256 JWT from the auth service", async () => {
      const email = "bff-jwt-obtain@example.com";
      const cookie = await signUpAndGetCookie(email, "JWT Obtain");

      const manager = new JwtManager({ authServiceUrl: httpServer.baseUrl }, logger);

      const token = await manager.getToken(cookie);

      expect(token).not.toBeNull();
      expect(typeof token).toBe("string");

      // RS256 JWT must have exactly 3 dot-separated segments
      const segments = token!.split(".");
      expect(segments).toHaveLength(3);

      // Decode payload and verify structure
      const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf-8"));
      expect(payload.exp).toBeDefined();
      expect(payload.iss).toBeDefined();
    });

    it("should return cached token on second call", async () => {
      const email = "bff-jwt-cache@example.com";
      const cookie = await signUpAndGetCookie(email, "JWT Cache");

      const manager = new JwtManager({ authServiceUrl: httpServer.baseUrl }, logger);

      const token1 = await manager.getToken(cookie);
      const token2 = await manager.getToken(cookie);

      expect(token1).not.toBeNull();
      expect(token1).toBe(token2); // Same cached token
    });

    it("should re-fetch after invalidate()", async () => {
      const email = "bff-jwt-invalidate@example.com";
      const cookie = await signUpAndGetCookie(email, "JWT Invalidate");

      const manager = new JwtManager({ authServiceUrl: httpServer.baseUrl }, logger);

      const token1 = await manager.getToken(cookie);
      expect(token1).not.toBeNull();

      manager.invalidate();

      const token2 = await manager.getToken(cookie);
      expect(token2).not.toBeNull();

      // Both are valid JWTs (may or may not be the same value — depends on
      // BetterAuth's JWT plugin behavior, but both must be valid 3-segment tokens)
      expect(token2!.split(".")).toHaveLength(3);
    });
  });
});
