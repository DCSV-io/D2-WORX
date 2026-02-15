import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createSessionFingerprintMiddleware } from "@d2/auth-api";

function createApp(options: {
  store: Map<string, string>;
  revoked: string[];
  failGet?: boolean;
  failStore?: boolean;
  failRevoke?: boolean;
}) {
  const middleware = createSessionFingerprintMiddleware({
    storeFingerprint: async (token, fp) => {
      if (options.failStore) throw new Error("Redis down");
      options.store.set(token, fp);
    },
    getFingerprint: async (token) => {
      if (options.failGet) throw new Error("Redis down");
      return options.store.get(token) ?? null;
    },
    revokeSession: async (token) => {
      if (options.failRevoke) throw new Error("Revoke failed");
      options.revoked.push(token);
      options.store.delete(token);
    },
  });

  const app = new Hono();
  app.use("*", middleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("Session fingerprint middleware", () => {
  let store: Map<string, string>;
  let revoked: string[];

  beforeEach(() => {
    store = new Map();
    revoked = [];
  });

  it("should pass through when no session token is present", async () => {
    const app = createApp({ store, revoked });
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(store.size).toBe(0);
  });

  it("should store fingerprint on first request with session token", async () => {
    const app = createApp({ store, revoked });
    const res = await app.request("/test", {
      headers: { cookie: "better-auth.session_token=tok123" },
    });
    expect(res.status).toBe(200);
    expect(store.has("tok123")).toBe(true);
    expect(store.get("tok123")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should pass when fingerprint matches", async () => {
    const app = createApp({ store, revoked });

    // First request — stores fingerprint
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "TestBrowser/1.0",
        accept: "text/html",
      },
    });

    // Second request — same headers = same fingerprint
    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "TestBrowser/1.0",
        accept: "text/html",
      },
    });
    expect(res.status).toBe(200);
    expect(revoked).toHaveLength(0);
  });

  it("should reject and revoke when fingerprint changes", async () => {
    const app = createApp({ store, revoked });

    // First request — stores fingerprint
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    // Second request — different UA = different fingerprint
    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "Firefox/115",
        accept: "text/html",
      },
    });
    expect(res.status).toBe(401);
    expect(revoked).toContain("tok123");
  });

  it("should return D2Result unauthorized on fingerprint mismatch", async () => {
    const app = createApp({ store, revoked });

    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "Chrome/120",
      },
    });

    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "curl/7.0",
      },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("should fail open when Redis GET fails", async () => {
    const app = createApp({ store, revoked, failGet: true });

    // Even with a stored fingerprint, Redis failure → pass through
    store.set("tok123", "some-fingerprint");
    const res = await app.request("/test", {
      headers: { cookie: "better-auth.session_token=tok123" },
    });
    expect(res.status).toBe(200);
  });

  it("should still pass when Redis store fails", async () => {
    const app = createApp({ store, revoked, failStore: true });

    const res = await app.request("/test", {
      headers: { cookie: "better-auth.session_token=tok123" },
    });
    expect(res.status).toBe(200);
    // Fingerprint was NOT stored due to failure
    expect(store.size).toBe(0);
  });

  it("should still return 401 when revoke fails", async () => {
    const app = createApp({ store, revoked, failRevoke: true });

    // Store a fingerprint
    store.set("tok123", "fingerprint-a");

    // Different fingerprint
    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok123",
        "user-agent": "completely-different",
        accept: "something-else",
      },
    });
    // Still 401 even if revocation fails
    expect(res.status).toBe(401);
  });

  it("should extract token from Authorization: Bearer header", async () => {
    const app = createApp({ store, revoked });

    const res = await app.request("/test", {
      headers: { authorization: "Bearer bearer-tok-456" },
    });
    expect(res.status).toBe(200);
    expect(store.has("bearer-tok-456")).toBe(true);
  });

  it("should handle multiple cookies correctly", async () => {
    const app = createApp({ store, revoked });

    const res = await app.request("/test", {
      headers: {
        cookie: "other=xyz; better-auth.session_token=multi-tok; another=abc",
      },
    });
    expect(res.status).toBe(200);
    expect(store.has("multi-tok")).toBe(true);
  });

  it("should treat different sessions independently", async () => {
    const app = createApp({ store, revoked });

    // Session A with one UA
    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=session-a",
        "user-agent": "Chrome/120",
      },
    });

    // Session B with different UA — should NOT trigger mismatch
    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=session-b",
        "user-agent": "Firefox/115",
      },
    });
    expect(res.status).toBe(200);
    expect(revoked).toHaveLength(0);
  });

  it("should detect Accept header changes as fingerprint change", async () => {
    const app = createApp({ store, revoked });

    await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-accept",
        "user-agent": "Chrome/120",
        accept: "text/html",
      },
    });

    const res = await app.request("/test", {
      headers: {
        cookie: "better-auth.session_token=tok-accept",
        "user-agent": "Chrome/120",
        accept: "application/json",
      },
    });
    expect(res.status).toBe(401);
    expect(revoked).toContain("tok-accept");
  });
});
