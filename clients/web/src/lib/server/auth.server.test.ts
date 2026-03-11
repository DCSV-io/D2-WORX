import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @d2/logging before importing the module under test
vi.mock("@d2/logging", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
}));

// Mock @d2/auth-bff-client
vi.mock("@d2/auth-bff-client", () => ({
  SessionResolver: vi.fn(),
  JwtManager: vi.fn(),
  AuthProxy: vi.fn(),
}));

describe("getAuthContext", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SVELTEKIT_AUTH__URL;
    delete process.env.SVELTEKIT_AUTH__API_KEY;
  });

  it("throws when SVELTEKIT_AUTH__URL is missing", async () => {
    const { getAuthContext } = await import("./auth.server.js");
    expect(() => getAuthContext()).toThrow("SVELTEKIT_AUTH__URL");
  });

  it("returns AuthContext when SVELTEKIT_AUTH__URL is set", async () => {
    process.env.SVELTEKIT_AUTH__URL = "http://localhost:5100";

    const { getAuthContext } = await import("./auth.server.js");
    const ctx = getAuthContext();

    expect(ctx).toBeDefined();
    expect(ctx.config.authServiceUrl).toBe("http://localhost:5100");
    expect(ctx.sessionResolver).toBeDefined();
    expect(ctx.jwtManager).toBeDefined();
    expect(ctx.authProxy).toBeDefined();
    expect(ctx.logger).toBeDefined();
  });

  it("passes apiKey from SVELTEKIT_AUTH__API_KEY to config", async () => {
    process.env.SVELTEKIT_AUTH__URL = "http://localhost:5100";
    process.env.SVELTEKIT_AUTH__API_KEY = "test-api-key";

    const { getAuthContext } = await import("./auth.server.js");
    const ctx = getAuthContext();

    expect(ctx.config.apiKey).toBe("test-api-key");
  });

  it("returns same instance on subsequent calls (singleton)", async () => {
    process.env.SVELTEKIT_AUTH__URL = "http://localhost:5100";

    const { getAuthContext } = await import("./auth.server.js");
    const first = getAuthContext();
    const second = getAuthContext();

    expect(first).toBe(second);
  });
});
