import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { RecipientResolver } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("RecipientResolver", () => {
  it("should resolve email and phone from userId", async () => {
    const contacts = new Map();
    contacts.set("auth_user:user-123", [
      {
        id: "c1",
        contextKey: "auth_user",
        relatedEntityId: "user-123",
        contactMethods: {
          emails: [{ value: "user@example.com", labels: [] }],
          phoneNumbers: [{ value: "+15551234567", labels: [] }],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
    };
    const geoIds = { handleAsync: vi.fn() };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-123" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("user@example.com");
    expect(result.data!.phone).toBe("+15551234567");
  });

  it("should return empty when geo returns no contacts", async () => {
    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };
    const geoIds = { handleAsync: vi.fn() };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-999" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should return empty when neither userId nor contactId provided", async () => {
    const geo = { handleAsync: vi.fn() };
    const geoIds = { handleAsync: vi.fn() };
    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({});

    expect(result.success).toBe(true);
    expect(geo.handleAsync).not.toHaveBeenCalled();
  });

  it("should handle geo-client failure gracefully", async () => {
    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Geo unavailable"] })),
    };
    const geoIds = { handleAsync: vi.fn() };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-123" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
  });

  it("should resolve email-only when phone not available", async () => {
    const contacts = new Map();
    contacts.set("auth_user:user-456", [
      {
        id: "c2",
        contextKey: "auth_user",
        relatedEntityId: "user-456",
        contactMethods: {
          emails: [{ value: "only@email.com", labels: [] }],
          phoneNumbers: [],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
    };
    const geoIds = { handleAsync: vi.fn() };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-456" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("only@email.com");
    expect(result.data!.phone).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // contactId path (GetContactsByIds)
  // -------------------------------------------------------------------------

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

    const geo = { handleAsync: vi.fn() };
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contactMap } })),
    };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-xyz" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("invitee@example.com");
    expect(result.data!.phone).toBe("+15559876543");
    expect(geo.handleAsync).not.toHaveBeenCalled();
    expect(geoIds.handleAsync).toHaveBeenCalledWith({ ids: ["contact-xyz"] });
  });

  it("should return empty when GetContactsByIds returns no contact for given id", async () => {
    const emptyMap = new Map();

    const geo = { handleAsync: vi.fn() };
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: emptyMap } })),
    };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-missing" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should handle GetContactsByIds failure gracefully", async () => {
    const geo = { handleAsync: vi.fn() };
    const geoIds = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Geo timeout"] })),
    };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-err" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
  });

  it("should prefer userId when both userId and contactId are provided", async () => {
    const contacts = new Map();
    contacts.set("auth_user:user-both", [
      {
        id: "c-user",
        contextKey: "auth_user",
        relatedEntityId: "user-both",
        contactMethods: {
          emails: [{ value: "user-path@example.com", labels: [] }],
          phoneNumbers: [],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
    };
    const geoIds = { handleAsync: vi.fn() };

    const resolver = new RecipientResolver(geo as any, geoIds as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-both", contactId: "contact-alt" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("user-path@example.com");
    // userId path should be used, not contactId path
    expect(geo.handleAsync).toHaveBeenCalled();
    expect(geoIds.handleAsync).not.toHaveBeenCalled();
  });
});
