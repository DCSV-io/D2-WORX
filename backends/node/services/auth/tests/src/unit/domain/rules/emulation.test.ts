import { describe, it, expect } from "vitest";
import { resolveSessionContext, canEmulate } from "@d2/auth-domain";
import type { Session } from "@d2/auth-domain";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    userId: "user-1",
    token: "token-abc",
    expiresAt: new Date(Date.now() + 3600_000),
    ipAddress: "127.0.0.1",
    userAgent: "test",
    createdAt: new Date(),
    updatedAt: new Date(),
    activeOrganizationId: "org-1",
    activeOrganizationType: "customer",
    activeOrganizationRole: "owner",
    emulatedOrganizationId: null,
    emulatedOrganizationType: null,
    ...overrides,
  };
}

describe("emulation rules", () => {
  describe("resolveSessionContext", () => {
    it("should return active org context when not emulating", () => {
      const session = makeSession();
      const ctx = resolveSessionContext(session);
      expect(ctx.userId).toBe("user-1");
      expect(ctx.effectiveOrgId).toBe("org-1");
      expect(ctx.effectiveOrgType).toBe("customer");
      expect(ctx.effectiveRole).toBe("owner");
      expect(ctx.isEmulating).toBe(false);
    });

    it("should return emulated org context with auditor role when emulating", () => {
      const session = makeSession({
        emulatedOrganizationId: "org-emulated",
        emulatedOrganizationType: "customer",
      });
      const ctx = resolveSessionContext(session);
      expect(ctx.userId).toBe("user-1");
      expect(ctx.effectiveOrgId).toBe("org-emulated");
      expect(ctx.effectiveOrgType).toBe("customer");
      expect(ctx.effectiveRole).toBe("auditor");
      expect(ctx.isEmulating).toBe(true);
    });

    it("should handle null active org fields", () => {
      const session = makeSession({
        activeOrganizationId: null,
        activeOrganizationType: null,
        activeOrganizationRole: null,
      });
      const ctx = resolveSessionContext(session);
      expect(ctx.effectiveOrgId).toBeNull();
      expect(ctx.effectiveOrgType).toBeNull();
      expect(ctx.effectiveRole).toBeNull();
      expect(ctx.isEmulating).toBe(false);
    });

    it("should force auditor role regardless of active role during emulation", () => {
      const session = makeSession({
        activeOrganizationRole: "owner",
        emulatedOrganizationId: "org-other",
        emulatedOrganizationType: "third_party",
      });
      const ctx = resolveSessionContext(session);
      expect(ctx.effectiveRole).toBe("auditor");
    });
  });

  describe("canEmulate", () => {
    it("should return true for support org type", () => {
      expect(canEmulate("support")).toBe(true);
    });

    it("should return true for admin org type", () => {
      expect(canEmulate("admin")).toBe(true);
    });

    it.each(["customer", "third_party", "affiliate"] as const)(
      "should return false for '%s' org type",
      (orgType) => {
        expect(canEmulate(orgType)).toBe(false);
      },
    );
  });
});
