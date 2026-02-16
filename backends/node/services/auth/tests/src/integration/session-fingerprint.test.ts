import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Hono } from "hono";
import { createSessionFingerprintMiddleware } from "@d2/auth-api";
import { startRedis, stopRedis, getRedis, flushRedis } from "./redis-test-helpers.js";

const SESSION_FP_PREFIX = "session:fp:";
const SESSION_FP_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Tests `createSessionFingerprintMiddleware` with real Redis for storage.
 *
 * Wires the middleware with real Redis callbacks matching the composition root
 * pattern (redis.set with EX, redis.get, redis.del).
 * Uses Hono test apps with `app.request()` (same as unit tests, but real Redis).
 */
describe("Session fingerprint middleware with Redis (integration)", () => {
  let app: Hono;

  beforeAll(async () => {
    await startRedis();
    rebuildApp();
  }, 120_000);

  afterAll(async () => {
    await stopRedis();
  });

  beforeEach(async () => {
    await flushRedis();
    rebuildApp();
  });

  function rebuildApp() {
    const redis = getRedis();

    const middleware = createSessionFingerprintMiddleware({
      storeFingerprint: async (token, fp) => {
        await redis.set(`${SESSION_FP_PREFIX}${token}`, fp, "EX", SESSION_FP_TTL_SECONDS);
      },
      getFingerprint: async (token) => {
        return redis.get(`${SESSION_FP_PREFIX}${token}`);
      },
      revokeSession: async (token) => {
        await redis.del(`${SESSION_FP_PREFIX}${token}`);
      },
    });

    app = new Hono();
    app.use("*", middleware);
    app.get("/test", (c) => c.json({ ok: true }));
  }

  it("should pass through when no session token is present", async () => {
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should store fingerprint in Redis on first request", async () => {
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-redis",
        "user-agent": "TestBrowser/1.0",
        accept: "text/html",
      },
    });

    const redis = getRedis();
    const stored = await redis.get(`${SESSION_FP_PREFIX}tok-redis`);
    expect(stored).toBeDefined();
    expect(stored).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("should pass when fingerprint matches", async () => {
    const headers = {
      cookie: "better-auth.session_token=tok-match",
      "user-agent": "Chrome/120",
      accept: "text/html",
    };

    // First request — stores fingerprint
    await app.request("/test", { headers });

    // Second request — same headers = same fingerprint
    const res = await app.request("/test", { headers });
    expect(res.status).toBe(200);
  });

  it("should return 401 on fingerprint mismatch", async () => {
    // Store with Chrome UA
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-mismatch",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    // Request with Firefox UA — different fingerprint
    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-mismatch",
        "user-agent": "Firefox/115",
        accept: "text/html",
      },
    });
    expect(res.status).toBe(401);
  });

  it("should delete fingerprint key from Redis on mismatch (revocation)", async () => {
    // Store fingerprint
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-revoke",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    // Trigger mismatch
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-revoke",
        "user-agent": "Firefox/115",
        accept: "text/html",
      },
    });

    // Key should be deleted
    const redis = getRedis();
    const exists = await redis.exists(`${SESSION_FP_PREFIX}tok-revoke`);
    expect(exists).toBe(0);
  });

  it("should set correct TTL on fingerprint key", async () => {
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-ttl",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    const redis = getRedis();
    const ttl = await redis.ttl(`${SESSION_FP_PREFIX}tok-ttl`);

    // Should be close to 7 days (604800 seconds)
    expect(ttl).toBeGreaterThan(SESSION_FP_TTL_SECONDS - 10);
    expect(ttl).toBeLessThanOrEqual(SESSION_FP_TTL_SECONDS);
  });

  it("should extract token from Authorization: Bearer header", async () => {
    await app.request("/test", {
      headers: {
        authorization: "Bearer bearer-tok-fp",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    const redis = getRedis();
    const stored = await redis.get(`${SESSION_FP_PREFIX}bearer-tok-fp`);
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
  });
});
