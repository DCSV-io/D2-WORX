import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { RecipientResolver } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("RecipientResolver", () => {
  it("should resolve email and phone from contactId", async () => {
    const contactMap = new Map();
    contactMap.set("contact-xyz", {
      id: "contact-xyz",
      contextKey: "auth_org_invitation",
      relatedEntityId: "inv-1",
      contactMethods: {
        emails: [{ value: "invitee@example.com", labels: [] }],
        phoneNumbers: [{ value: "+15559876543", labels: [] }],
      },
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-xyz" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("invitee@example.com");
    expect(result.data!.phone).toBe("+15559876543");
    expect(geoIds.handleAsync).toHaveBeenCalledWith({ ids: ["contact-xyz"] });
  });

  it("should return empty when no contact found for given id", async () => {
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-missing" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should handle geo failure gracefully", async () => {
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Geo timeout"] })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-err" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Defensive edge cases
  // -------------------------------------------------------------------------

  it("should treat empty string contactId as falsy (skip Geo call)", async () => {
    const geoIds = { handleAsync: vi.fn() };
    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "" });

    expect(result.success).toBe(true);
    // Empty string is falsy — should NOT call geo
    expect(geoIds.handleAsync).not.toHaveBeenCalled();
  });

  it("should handle contact with empty emails and phoneNumbers arrays", async () => {
    const contactMap = new Map();
    contactMap.set("contact-empty", {
      id: "contact-empty",
      contextKey: "auth_user",
      relatedEntityId: "user-empty",
      contactMethods: {
        emails: [],
        phoneNumbers: [],
      },
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-empty" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should handle contact with undefined contactMethods", async () => {
    const contactMap = new Map();
    contactMap.set("contact-no-methods", {
      id: "contact-no-methods",
      contextKey: "auth_user",
      relatedEntityId: "user-no-methods",
      contactMethods: undefined,
      personalDetails: undefined,
      professionalDetails: undefined,
      location: undefined,
      createdAt: new Date(),
    });

    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-no-methods" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });
});
