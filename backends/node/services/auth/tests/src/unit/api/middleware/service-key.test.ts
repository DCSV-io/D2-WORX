import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createServiceKeyMiddleware, REQUEST_CONTEXT_KEY } from "@d2/auth-api";
import type { IRequestContext } from "@d2/handler";
import { TK } from "@d2/i18n";

/** Stub requestContext for testing — pre-seeds context before service-key runs. */
function createStubRequestContext(overrides?: Partial<IRequestContext>): IRequestContext {
  return {
    clientIp: "127.0.0.1",
    serverFingerprint: "abc123",
    clientFingerprint: undefined,
    deviceFingerprint: "a".repeat(64),
    whoIsHashId: undefined,
    city: undefined,
    countryCode: undefined,
    subdivisionCode: undefined,
    isVpn: undefined,
    isProxy: undefined,
    isTor: undefined,
    isHosting: undefined,
    isAuthenticated: false,
    isTrustedService: false,
    isOrgEmulating: false,
    isUserImpersonating: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    ...overrides,
  };
}

const VALID_KEY = "test-api-key-1";
const VALID_KEYS = [VALID_KEY, "test-api-key-2"];

function createApp(options?: { require?: boolean }) {
  const app = new Hono();

  // Simulate request-enrichment setting requestContext before service-key runs
  app.use("*", async (c, next) => {
    c.set(REQUEST_CONTEXT_KEY, createStubRequestContext());
    await next();
  });

  app.use("*", createServiceKeyMiddleware(VALID_KEYS, options));

  app.get("/test", (c) => {
    const ctx = c.get(REQUEST_CONTEXT_KEY) as IRequestContext;
    return c.json({ isTrustedService: ctx.isTrustedService });
  });

  return app;
}

describe("Service key middleware", () => {
  it("passes through when no X-Api-Key header is present", async () => {
    const app = createApp();
    const res = await app.request("/test");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrustedService).toBe(false);
  });

  it("sets isTrustedService=true for a valid API key", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Api-Key": VALID_KEY },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrustedService).toBe(true);
  });

  it("returns 401 for an invalid API key", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Api-Key": "invalid-key" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.messages).toContain(TK.common.errors.UNAUTHORIZED);
  });

  it("does not modify requestContext when key is invalid (short-circuits)", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Api-Key": "bad-key" },
    });

    // 401 response — handler never reached
    expect(res.status).toBe(401);
  });

  it("accepts any valid key from the set", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { "X-Api-Key": "test-api-key-2" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrustedService).toBe(true);
  });
});

describe("Service key middleware (require: true)", () => {
  it("returns 401 when no X-Api-Key header is present", async () => {
    const app = createApp({ require: true });
    const res = await app.request("/test");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.messages).toContain(TK.common.errors.UNAUTHORIZED);
  });

  it("sets isTrustedService=true for a valid API key", async () => {
    const app = createApp({ require: true });
    const res = await app.request("/test", {
      headers: { "X-Api-Key": VALID_KEY },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isTrustedService).toBe(true);
  });

  it("returns 401 for an invalid API key", async () => {
    const app = createApp({ require: true });
    const res = await app.request("/test", {
      headers: { "X-Api-Key": "invalid-key" },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.messages).toContain(TK.common.errors.UNAUTHORIZED);
  });
});
