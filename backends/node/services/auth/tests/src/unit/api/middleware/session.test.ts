import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createSessionMiddleware, USER_KEY, SESSION_KEY } from "@d2/auth-api";
import type { Auth } from "@d2/auth-infra";

/**
 * Creates a minimal mock Auth object with a controllable getSession implementation.
 */
function mockAuth(getSession: (opts: { headers: Headers }) => Promise<unknown>): Auth {
  return {
    api: { getSession },
  } as unknown as Auth;
}

/**
 * Creates a test Hono app with the session middleware applied.
 */
function createApp(auth: Auth) {
  const app = new Hono();
  app.use("*", createSessionMiddleware(auth));
  app.get("/test", (c) => c.json({ ok: true, user: c.get(USER_KEY), session: c.get(SESSION_KEY) }));
  return app;
}

describe("createSessionMiddleware", () => {
  it("should set user and session when getSession succeeds", async () => {
    const auth = mockAuth(async () => ({
      user: { id: "user-1", email: "test@test.com", name: "Test" },
      session: { id: "sess-1", activeOrganizationId: "org-1" },
    }));
    const app = createApp(auth);

    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toEqual({ id: "user-1", email: "test@test.com", name: "Test" });
    expect(body.session).toMatchObject({ id: "sess-1" });
  });

  it("should return 401 when getSession returns null (unauthenticated)", async () => {
    const auth = mockAuth(async () => null);
    const app = createApp(auth);

    const res = await app.request("/test");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.statusCode).toBe(401);
  });

  it("should return 503 when getSession throws (fail-closed)", async () => {
    const auth = mockAuth(async () => {
      throw new Error("Redis connection refused");
    });
    const app = createApp(auth);

    const res = await app.request("/test");

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.messages[0]).toContain("Service temporarily unavailable");
  });

  it("should return 503 on infrastructure failure, not 401", async () => {
    // This specifically tests the fail-closed principle:
    // Infrastructure errors must NOT silently degrade to "unauthenticated"
    const auth = mockAuth(async () => {
      throw new Error("ECONNREFUSED");
    });
    const app = createApp(auth);

    const res = await app.request("/test");

    // Critical: must be 503, NOT 401
    expect(res.status).toBe(503);
    expect(res.status).not.toBe(401);
  });

  it("should not call next when session is null", async () => {
    const auth = mockAuth(async () => null);
    const app = new Hono();
    let nextReached = false;
    app.use("*", createSessionMiddleware(auth));
    app.get("/test", (c) => {
      nextReached = true;
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(nextReached).toBe(false);
  });

  it("should not call next when getSession throws", async () => {
    const auth = mockAuth(async () => {
      throw new Error("DB down");
    });
    const app = new Hono();
    let nextReached = false;
    app.use("*", createSessionMiddleware(auth));
    app.get("/test", (c) => {
      nextReached = true;
      return c.json({ ok: true });
    });

    await app.request("/test");

    expect(nextReached).toBe(false);
  });

  it("should return 401 when getSession returns undefined", async () => {
    const auth = mockAuth(async () => undefined);
    const app = createApp(auth);

    const res = await app.request("/test");

    // undefined is falsy like null — must not reach route handler
    expect(res.status).toBe(401);
  });

  it("should return 503 when getSession rejects with non-Error", async () => {
    const auth = mockAuth(async () => {
      throw "string error";
    });
    const app = createApp(auth);

    const res = await app.request("/test");

    // Non-Error throws still fail-closed (503, not 401)
    expect(res.status).toBe(503);
  });

  it("should not leak infrastructure error details to client", async () => {
    const auth = mockAuth(async () => {
      throw new Error("pg: password authentication failed for user 'admin'");
    });
    const app = createApp(auth);

    const res = await app.request("/test");
    const body = await res.json();

    expect(res.status).toBe(503);
    // Must NOT contain internal error details
    expect(JSON.stringify(body)).not.toContain("password authentication");
    expect(JSON.stringify(body)).not.toContain("admin");
  });

  it("should forward request headers to getSession", async () => {
    const getSession = vi.fn().mockResolvedValue({
      user: { id: "u-1", email: "t@t.com", name: "T" },
      session: { id: "s-1" },
    });
    const auth = mockAuth(getSession);
    const app = createApp(auth);

    await app.request("/test", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(getSession).toHaveBeenCalledTimes(1);
    const callHeaders = getSession.mock.calls[0][0].headers;
    expect(callHeaders).toBeDefined();
  });
});
