import { describe, it, expect } from "vitest";
import {
  ac,
  ownerPermissions,
  officerPermissions,
  agentPermissions,
  auditorPermissions,
} from "@d2/auth-infra";

describe("Access Control", () => {
  describe("role definitions", () => {
    it("should define auditor with read-only businessData and orgSettings", () => {
      const statements = auditorPermissions.statements;
      expect(statements.businessData).toContain("read");
      expect(statements.businessData).not.toContain("create");
      expect(statements.businessData).not.toContain("update");
      expect(statements.businessData).not.toContain("delete");
      expect(statements.orgSettings).toContain("read");
      expect(statements.orgSettings).not.toContain("update");
    });

    it("should define agent with auditor perms + businessData create/update", () => {
      const statements = agentPermissions.statements;
      expect(statements.businessData).toContain("read");
      expect(statements.businessData).toContain("create");
      expect(statements.businessData).toContain("update");
      expect(statements.businessData).not.toContain("delete");
    });

    it("should define officer with agent perms + delete + billing + member CRU", () => {
      const statements = officerPermissions.statements;
      expect(statements.businessData).toContain("delete");
      expect(statements.billing).toContain("read");
      expect(statements.billing).toContain("update");
      expect(statements.member).toContain("create");
      expect(statements.member).toContain("read");
      expect(statements.member).toContain("update");
      expect(statements.member).not.toContain("delete");
    });

    it("should define owner with all permissions", () => {
      const statements = ownerPermissions.statements;
      expect(statements.orgSettings).toContain("update");
      expect(statements.organization).toContain("update");
      expect(statements.organization).toContain("delete");
      expect(statements.member).toContain("delete");
      expect(statements.invitation).toContain("create");
      expect(statements.invitation).toContain("cancel");
    });
  });

  describe("access control instance", () => {
    it("should be defined", () => {
      expect(ac).toBeDefined();
    });
  });
});
