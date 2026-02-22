import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createScopeMiddleware, SCOPE_KEY } from "@d2/auth-api";
import { IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import { SESSION_FIELDS } from "@d2/auth-domain";

/**
 * Creates a mock ServiceProvider that returns controllable scopes.
 * Tracks setInstance calls and supports resolve for ILoggerKey.
 */
function createMockProvider() {
  const disposeFn = vi.fn();
  const instances = new Map<unknown, unknown>();

  const scope = {
    setInstance: vi.fn((key: unknown, value: unknown) => {
      instances.set(key, value);
    }),
    resolve: vi.fn((key: unknown) => {
      if (instances.has(key)) return instances.get(key);
      throw new Error(`Key not registered in scope: ${String(key)}`);
    }),
    dispose: disposeFn,
    getInstance: (key: unknown) => instances.get(key),
  };

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const provider = {
    createScope: vi.fn(() => scope),
    resolve: vi.fn((key: unknown) => {
      if (key === ILoggerKey) return logger;
      throw new Error(`Key not registered in provider: ${String(key)}`);
    }),
  };

  return { provider, scope, disposeFn, logger };
}

type User = { id: string; email: string; name: string } | null;
type Session = Record<string, unknown> | null;

/**
 * Creates a Hono app with scope middleware and a test route that captures IRequestContext.
 */
function createTestApp(mockProvider: ReturnType<typeof createMockProvider>, user: User, session: Session) {
  const app = new Hono();

  // Simulate session middleware (sets user/session vars)
  app.use("*", async (c, next) => {
    if (user) c.set("user" as never, user as never);
    if (session) c.set("session" as never, session as never);
    await next();
  });

  app.use("*", createScopeMiddleware(mockProvider.provider as any));

  // Test route that captures the IRequestContext from the scope
  app.get("/test", (c) => {
    const scope = c.get(SCOPE_KEY as never) as any;
    const ctx = scope.getInstance(IRequestContextKey) as IRequestContext;
    return c.json(ctx);
  });

  return app;
}

function get(app: Hono) {
  return app.request("/test", { method: "GET" });
}

describe("Scope Middleware", () => {
  describe("buildRequestContext (via middleware)", () => {
    it("should set isAuthenticated false for unauthenticated request", async () => {
      const mock = createMockProvider();
      const app = createTestApp(mock, null, null);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAuthenticated).toBe(false);
      expect(ctx.userId).toBeUndefined();
      expect(ctx.email).toBeUndefined();
    });

    it("should set isAuthenticated true with userId and email for authenticated request", async () => {
      const mock = createMockProvider();
      const user = { id: "user-1", email: "user@example.com", name: "Test" };
      const session = { [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "customer" };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAuthenticated).toBe(true);
      expect(ctx.userId).toBe("user-1");
      expect(ctx.email).toBe("user@example.com");
    });

    it("should map admin org type to isAgentStaff true and isAgentAdmin true", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "admin@test.com", name: "Admin" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "admin",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-admin",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(true);
      expect(ctx.isAgentAdmin).toBe(true);
      expect(ctx.agentOrgType).toBe("Admin");
    });

    it("should map support org type to isAgentStaff true and isAgentAdmin false", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "support@test.com", name: "Support" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "support",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-support",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(true);
      expect(ctx.isAgentAdmin).toBe(false);
      expect(ctx.agentOrgType).toBe("Support");
    });

    it("should map customer org type to isAgentStaff false and isAgentAdmin false", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "cust@test.com", name: "Cust" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "customer",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-cust",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(false);
      expect(ctx.isAgentAdmin).toBe(false);
      expect(ctx.agentOrgType).toBe("Customer");
    });

    it("should map third_party org type correctly (Bug 1 fix)", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "tp@test.com", name: "TP" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "third_party",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-tp",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(false);
      expect(ctx.isAgentAdmin).toBe(false);
      expect(ctx.agentOrgType).toBe("ThirdParty");
    });

    it("should map affiliate org type correctly", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "aff@test.com", name: "Aff" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "affiliate",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-aff",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(false);
      expect(ctx.agentOrgType).toBe("Affiliate");
    });

    it("should set emulation fields when emulating", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "admin@test.com", name: "Admin" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "admin",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-admin",
        [SESSION_FIELDS.EMULATED_ORG_ID]: "org-customer",
        [SESSION_FIELDS.EMULATED_ORG_TYPE]: "customer",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isOrgEmulating).toBe(true);
      expect(ctx.targetOrgId).toBe("org-customer");
      expect(ctx.agentOrgId).toBe("org-admin");
      expect(ctx.targetOrgType).toBe("Customer");
      expect(ctx.agentOrgType).toBe("Admin");
    });

    it("should set targetOrgId equal to agentOrgId when not emulating", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "cust@test.com", name: "Cust" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "customer",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-cust",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isOrgEmulating).toBe(false);
      expect(ctx.targetOrgId).toBe("org-cust");
      expect(ctx.agentOrgId).toBe("org-cust");
    });

    it("should set isTargetingStaff false when admin emulates customer", async () => {
      const mock = createMockProvider();
      const user = { id: "u1", email: "admin@test.com", name: "Admin" };
      const session = {
        [SESSION_FIELDS.ACTIVE_ORG_TYPE]: "admin",
        [SESSION_FIELDS.ACTIVE_ORG_ID]: "org-admin",
        [SESSION_FIELDS.EMULATED_ORG_ID]: "org-customer",
        [SESSION_FIELDS.EMULATED_ORG_TYPE]: "customer",
      };
      const app = createTestApp(mock, user, session);

      const res = await get(app);
      const ctx = (await res.json()) as IRequestContext;

      expect(ctx.isAgentStaff).toBe(true);
      expect(ctx.isTargetingStaff).toBe(false);
    });

    it("should generate a unique traceId per request", async () => {
      const mock = createMockProvider();
      const app = createTestApp(mock, null, null);

      const res1 = await get(app);
      const ctx1 = (await res1.json()) as IRequestContext;
      const res2 = await get(app);
      const ctx2 = (await res2.json()) as IRequestContext;

      expect(ctx1.traceId).toBeDefined();
      expect(ctx2.traceId).toBeDefined();
      expect(ctx1.traceId).not.toBe(ctx2.traceId);
    });
  });

  describe("createScopeMiddleware lifecycle", () => {
    it("should dispose scope after request completes", async () => {
      const mock = createMockProvider();
      const app = createTestApp(mock, null, null);

      await get(app);

      expect(mock.disposeFn).toHaveBeenCalledOnce();
    });
  });
});
