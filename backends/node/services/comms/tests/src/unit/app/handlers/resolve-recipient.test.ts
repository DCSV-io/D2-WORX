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

  it("should propagate notFound when geo returns NOT_FOUND", async () => {
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.notFound()),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-missing" });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("NOT_FOUND");
  });

  it("should return empty when contact found but not in result map", async () => {
    // Edge case: geo returns ok with empty map (e.g. empty IDs were requested)
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-missing" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should propagate geo failure via bubbleFail", async () => {
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["Geo timeout"], statusCode: 503 }),
      ),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-err" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.messages).toContain("Geo timeout");
  });

  it("should propagate geo 400 failure without masking status code", async () => {
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["Invalid contact ID format"], statusCode: 400 }),
      ),
    };

    const resolver = new RecipientResolver(geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-err" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.messages).toContain("Invalid contact ID format");
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
