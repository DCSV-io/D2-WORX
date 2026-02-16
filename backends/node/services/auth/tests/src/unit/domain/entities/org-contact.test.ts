import { describe, it, expect } from "vitest";
import { createOrgContact, updateOrgContact, AuthValidationError } from "@d2/auth-domain";

describe("OrgContact", () => {
  const validInput = {
    organizationId: "org-123",
    label: "Headquarters",
  };

  describe("createOrgContact", () => {
    it("should create an org contact with valid input", () => {
      const oc = createOrgContact(validInput);
      expect(oc.organizationId).toBe("org-123");
      expect(oc.label).toBe("Headquarters");
      expect(oc.isPrimary).toBe(false);
      expect(oc.id).toHaveLength(36);
      expect(oc.createdAt).toBeInstanceOf(Date);
      expect(oc.updatedAt).toBeInstanceOf(Date);
    });

    it("should accept a pre-generated ID", () => {
      const oc = createOrgContact({ ...validInput, id: "custom-id" });
      expect(oc.id).toBe("custom-id");
    });

    it("should accept isPrimary = true", () => {
      const oc = createOrgContact({ ...validInput, isPrimary: true });
      expect(oc.isPrimary).toBe(true);
    });

    it("should clean whitespace in label", () => {
      const oc = createOrgContact({ ...validInput, label: "  Main   Office  " });
      expect(oc.label).toBe("Main Office");
    });

    it("should throw AuthValidationError for empty organizationId", () => {
      expect(() => createOrgContact({ ...validInput, organizationId: "" })).toThrow(
        AuthValidationError,
      );
    });

    it("should throw AuthValidationError for empty label", () => {
      expect(() => createOrgContact({ ...validInput, label: "  " })).toThrow(AuthValidationError);
    });
  });

  describe("updateOrgContact", () => {
    const baseOrgContact = createOrgContact(validInput);

    it("should update the label", () => {
      const updated = updateOrgContact(baseOrgContact, { label: "Branch Office" });
      expect(updated.label).toBe("Branch Office");
    });

    it("should update isPrimary", () => {
      const updated = updateOrgContact(baseOrgContact, { isPrimary: true });
      expect(updated.isPrimary).toBe(true);
    });

    it("should throw AuthValidationError for empty label update", () => {
      expect(() => updateOrgContact(baseOrgContact, { label: "" })).toThrow(AuthValidationError);
    });

    it("should set updatedAt to a new timestamp", () => {
      const updated = updateOrgContact(baseOrgContact, { label: "Updated" });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        baseOrgContact.updatedAt.getTime(),
      );
    });

    it("should preserve unchanged fields", () => {
      const updated = updateOrgContact(baseOrgContact, { isPrimary: true });
      expect(updated.id).toBe(baseOrgContact.id);
      expect(updated.organizationId).toBe(baseOrgContact.organizationId);
      expect(updated.label).toBe(baseOrgContact.label);
      expect(updated.createdAt).toBe(baseOrgContact.createdAt);
    });
  });
});
