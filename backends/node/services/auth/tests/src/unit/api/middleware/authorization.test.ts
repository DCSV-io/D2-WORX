import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { requireOrg, requireOrgType, requireRole, requireStaff, requireAdmin } from "@d2/auth-api";
import type { SessionVariables } from "@d2/auth-api";

/**
 * Creates a test Hono app with the given middleware applied.
 * A setup middleware injects session variables before the auth middleware runs.
 */
function createApp(
  session: Record<string, unknown> | null,
  ...middlewares: ReturnType<typeof requireOrg>[]
) {
  const app = new Hono<{ Variables: SessionVariables }>();

  // Inject session into c.var (simulates session middleware)
  app.use("*", async (c, next) => {
    c.set("user", session ? { id: "user-1", email: "test@test.com", name: "Test" } : null);
    c.set("session", session);
    await next();
  });

  for (const mw of middlewares) {
    app.use("*", mw);
  }

  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

/** Helper to build a session with active org fields. */
function sessionWith(
  orgId: string,
  orgType: string,
  role: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    activeOrganizationId: orgId,
    activeOrganizationType: orgType,
    activeOrganizationRole: role,
    ...extra,
  };
}

describe("requireOrg", () => {
  it("should pass when session has active org", async () => {
    const app = createApp(sessionWith("org-1", "customer", "owner"), requireOrg());
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject with 401 when no session", async () => {
    const app = createApp(null, requireOrg());
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("should reject with 403 when session has no active org", async () => {
    const app = createApp({}, requireOrg());
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages[0]).toContain("No active organization");
  });

  it("should reject with 403 when orgType is invalid", async () => {
    const app = createApp(
      {
        activeOrganizationId: "org-1",
        activeOrganizationType: "bogus",
        activeOrganizationRole: "owner",
      },
      requireOrg(),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });

  it("should reject with 403 when role is invalid", async () => {
    const app = createApp(
      {
        activeOrganizationId: "org-1",
        activeOrganizationType: "customer",
        activeOrganizationRole: "bogus",
      },
      requireOrg(),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });
});

describe("requireOrgType", () => {
  it("should pass when orgType matches single allowed type", async () => {
    const app = createApp(sessionWith("org-1", "admin", "owner"), requireOrgType("admin"));
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should pass when orgType matches one of multiple allowed types", async () => {
    const app = createApp(
      sessionWith("org-1", "support", "officer"),
      requireOrgType("admin", "support"),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject when orgType does not match", async () => {
    const app = createApp(sessionWith("org-1", "customer", "owner"), requireOrgType("admin"));
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages[0]).toContain("Organization type not authorized");
  });

  it("should reject with 401 when no session", async () => {
    const app = createApp(null, requireOrgType("admin"));
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  it("should pass when role equals minRole", async () => {
    const app = createApp(sessionWith("org-1", "customer", "officer"), requireRole("officer"));
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should pass when role is above minRole", async () => {
    const app = createApp(sessionWith("org-1", "customer", "owner"), requireRole("officer"));
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject when role is below minRole", async () => {
    const app = createApp(sessionWith("org-1", "customer", "agent"), requireRole("officer"));
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages[0]).toContain("Insufficient role");
  });

  it("should reject auditor when minRole is agent", async () => {
    const app = createApp(sessionWith("org-1", "customer", "auditor"), requireRole("agent"));
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });

  it("should pass auditor when minRole is auditor", async () => {
    const app = createApp(sessionWith("org-1", "customer", "auditor"), requireRole("auditor"));
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject with 401 when no session", async () => {
    const app = createApp(null, requireRole("agent"));
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });
});

describe("requireStaff", () => {
  it("should pass for admin orgType", async () => {
    const app = createApp(sessionWith("org-1", "admin", "owner"), requireStaff());
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should pass for support orgType", async () => {
    const app = createApp(sessionWith("org-1", "support", "officer"), requireStaff());
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject customer orgType", async () => {
    const app = createApp(sessionWith("org-1", "customer", "owner"), requireStaff());
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });
});

describe("requireAdmin", () => {
  it("should pass for admin orgType", async () => {
    const app = createApp(sessionWith("org-1", "admin", "owner"), requireAdmin());
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject support orgType", async () => {
    const app = createApp(sessionWith("org-1", "support", "officer"), requireAdmin());
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });
});

describe("middleware composition", () => {
  it("should pass when all composed middleware checks succeed", async () => {
    const app = createApp(
      sessionWith("org-1", "admin", "officer"),
      requireOrg(),
      requireStaff(),
      requireRole("officer"),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("should reject at first failing middleware in chain", async () => {
    // requireStaff() should fail (customer), even though role is sufficient
    const app = createApp(
      sessionWith("org-1", "customer", "owner"),
      requireOrg(),
      requireStaff(),
      requireRole("officer"),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages[0]).toContain("Organization type not authorized");
  });

  it("should reject at role check when orgType passes but role is too low", async () => {
    const app = createApp(
      sessionWith("org-1", "admin", "agent"),
      requireOrg(),
      requireStaff(),
      requireRole("officer"),
    );
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.messages[0]).toContain("Insufficient role");
  });
});
