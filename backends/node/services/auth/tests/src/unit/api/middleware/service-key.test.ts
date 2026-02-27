import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createServiceKeyMiddleware, REQUEST_INFO_KEY } from "@d2/auth-api";
import type { IRequestInfo } from "@d2/request-enrichment";

/** Stub requestInfo for testing — pre-seeds context before service-key runs. */
function createStubRequestInfo(overrides?: Partial<IRequestInfo>): IRequestInfo {
  return {
    clientIp: "127.0.0.1",
    serverFingerprint: "abc123",
    clientFingerprint: undefined,
    whoIsHashId: undefined,
    city: undefined,
    countryCode: undefined,
    subdivisionCode: undefined,
    isVpn: undefined,
    isProxy: undefined,
    isTor: undefined,
    isHosting: undefined,
    userId: undefined,
    isAuthenticated: false,
    isTrustedService: false,
    ...overrides,
  };
}

const VALID_KEY = "test-api-key-1";
const VALID_KEYS = new Set([VALID_KEY, "test-api-key-2"]);

function createApp() {
  const app = new Hono();

  // Simulate request-enrichment setting requestInfo before service-key runs
  app.use("*", async (c, next) => {
    c.set(REQUEST_INFO_KEY, createStubRequestInfo());
    await next();
  });

  app.use("*", createServiceKeyMiddleware(VALID_KEYS));

  app.get("/test", (c) => {
    const info = c.get(REQUEST_INFO_KEY) as IRequestInfo;
    return c.json({ isTrustedService: info.isTrustedService });
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
    expect(body.messages).toContain("Invalid API key.");
  });

  it("does not modify requestInfo when key is invalid (short-circuits)", async () => {
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
