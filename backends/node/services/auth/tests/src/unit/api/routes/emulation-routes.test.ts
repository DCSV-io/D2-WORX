import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { D2Result, HttpStatusCode } from "@d2/result";
import {
  ICreateEmulationConsentKey,
  IRevokeEmulationConsentKey,
  IGetActiveConsentsKey,
} from "@d2/auth-app";
import { createEmulationRoutes, SCOPE_KEY } from "@d2/auth-api";

/** Creates mock handlers for emulation routes. */
function createMockHandlers() {
  return {
    create: {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.ok({
          data: { consent: { id: "c-1", userId: "u-1", grantedToOrgId: "org-1" } },
        }),
      ),
    },
    revoke: {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.ok({
          data: { consent: { id: "c-1", userId: "u-1" } },
        }),
      ),
    },
    getActive: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { consents: [] } })),
    },
  };
}

/** Creates a mock DI scope that returns the mock handlers on resolve(). */
function createMockScope(handlers: ReturnType<typeof createMockHandlers>) {
  const keyMap = new Map<string, unknown>([
    [ICreateEmulationConsentKey.id, handlers.create],
    [IRevokeEmulationConsentKey.id, handlers.revoke],
    [IGetActiveConsentsKey.id, handlers.getActive],
  ]);
  return {
    resolve: (key: { id: string }) => {
      const handler = keyMap.get(key.id);
      if (!handler) throw new Error(`No mock handler for key: ${key.id}`);
      return handler;
    },
  };
}

/**
 * Creates a test app with mock session + scope middleware.
 * Session middleware sets user and session on c.var.
 * Scope middleware sets the mock DI scope on c.var.
 */
function createTestApp(
  handlers: ReturnType<typeof createMockHandlers>,
  session: {
    userId?: string;
    activeOrganizationType?: string;
    activeOrganizationRole?: string;
    activeOrganizationId?: string;
  } = {},
) {
  const app = new Hono();

  // Mock session middleware
  app.use("*", async (c, next) => {
    c.set("user", { id: session.userId ?? "user-123", email: "test@test.com", name: "Test" });
    c.set("session", {
      activeOrganizationType: session.activeOrganizationType ?? "support",
      activeOrganizationRole: session.activeOrganizationRole ?? "owner",
      activeOrganizationId: session.activeOrganizationId ?? "org-session-1",
    });
    // Mock DI scope — routes resolve handlers from c.get("scope")
    c.set(SCOPE_KEY as never, createMockScope(handlers) as never);
    await next();
  });

  app.route("/", createEmulationRoutes());
  return app;
}

const VALID_UUID = "01234567-89ab-cdef-0123-456789abcdef";
const FUTURE_DATE = new Date(Date.now() + 86_400_000).toISOString();

describe("Emulation routes", () => {
  let handlers: ReturnType<typeof createMockHandlers>;

  beforeEach(() => {
    handlers = createMockHandlers();
  });

  describe("POST /api/emulation/consent — role checks", () => {
    it("should reject auditor role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "auditor" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
      expect(handlers.create.handleAsync).not.toHaveBeenCalled();
    });

    it("should reject agent role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "agent" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
      expect(handlers.create.handleAsync).not.toHaveBeenCalled();
    });

    it("should allow officer role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "officer" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(201);
    });

    it("should allow owner role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "owner" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(201);
    });

    it("should reject spoofed/invalid role string", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "superadmin" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/emulation/consent — staff org type check", () => {
    it("should reject customer org type (requireStaff)", async () => {
      const app = createTestApp(handlers, { activeOrganizationType: "customer" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
      expect(handlers.create.handleAsync).not.toHaveBeenCalled();
    });

    it("should reject third_party org type", async () => {
      const app = createTestApp(handlers, { activeOrganizationType: "third_party" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject affiliate org type", async () => {
      const app = createTestApp(handlers, { activeOrganizationType: "affiliate" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(403);
    });

    it("should allow support org type", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(201);
    });

    it("should allow admin org type", async () => {
      const app = createTestApp(handlers, { activeOrganizationType: "admin" });
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe("POST /api/emulation/consent — input mapping", () => {
    it("should pass session userId and org type to handler", async () => {
      const app = createTestApp(handlers, {
        userId: "real-user-id",
        activeOrganizationType: "admin",
      });
      await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(handlers.create.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "real-user-id",
          grantedToOrgId: VALID_UUID,
          activeOrgType: "admin",
        }),
      );
    });

    it("should convert expiresAt string to Date", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      const call = handlers.create.handleAsync.mock.calls[0][0];
      expect(call.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("POST /api/emulation/consent — status code mapping", () => {
    it("should return 201 on success", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(201);
    });

    it("should forward handler failure status code", async () => {
      handlers.create.handleAsync.mockResolvedValue(
        D2Result.fail({
          messages: ["Not found."],
          statusCode: HttpStatusCode.NotFound,
        }),
      );
      const app = createTestApp(handlers);
      const res = await app.request("/api/emulation/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grantedToOrgId: VALID_UUID, expiresAt: FUTURE_DATE }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/emulation/consent/:id — role checks", () => {
    it("should reject auditor role on DELETE", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "auditor" });
      const res = await app.request(`/api/emulation/consent/${VALID_UUID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
      expect(handlers.revoke.handleAsync).not.toHaveBeenCalled();
    });

    it("should reject agent role on DELETE", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "agent" });
      const res = await app.request(`/api/emulation/consent/${VALID_UUID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    it("should allow officer on DELETE", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "officer" });
      const res = await app.request(`/api/emulation/consent/${VALID_UUID}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/emulation/consent/:id — input mapping", () => {
    it("should pass session userId to handler (not from request)", async () => {
      const app = createTestApp(handlers, { userId: "real-user-id" });
      await app.request(`/api/emulation/consent/${VALID_UUID}`, {
        method: "DELETE",
      });
      expect(handlers.revoke.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          consentId: VALID_UUID,
          userId: "real-user-id",
        }),
      );
    });
  });

  describe("GET /api/emulation/consent — staff check", () => {
    it("should reject non-staff org type on GET", async () => {
      const app = createTestApp(handlers, { activeOrganizationType: "customer" });
      const res = await app.request("/api/emulation/consent");
      expect(res.status).toBe(403);
      expect(handlers.getActive.handleAsync).not.toHaveBeenCalled();
    });

    it("should allow any staff role on GET (no role minimum)", async () => {
      const app = createTestApp(handlers, {
        activeOrganizationType: "support",
        activeOrganizationRole: "auditor",
      });
      const res = await app.request("/api/emulation/consent");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/emulation/consent — pagination", () => {
    it("should apply default pagination", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50, offset: 0 }),
      );
    });

    it("should respect custom limit", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent?limit=10");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });

    it("should cap limit at 100", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent?limit=500");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    it("should handle negative limit gracefully", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent?limit=-1");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should handle non-numeric limit gracefully", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent?limit=abc");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("should handle negative offset gracefully", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/emulation/consent?offset=-5");
      expect(handlers.getActive.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0 }),
      );
    });
  });
});
