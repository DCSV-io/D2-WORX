import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { RecipientResolver } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("RecipientResolver — extended coverage", () => {
  it("should resolve by contactId using auth:contact context key", async () => {
    const contacts = new Map();
    contacts.set("auth:contact:contact-42", [
      {
        id: "c1",
        contextKey: "auth:contact",
        relatedEntityId: "contact-42",
        contactMethods: {
          emails: [{ value: "contact@example.com", labels: [] }],
          phoneNumbers: [{ value: "+15559876543", labels: [] }],
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ contactId: "contact-42" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("contact@example.com");
    expect(result.data!.phone).toBe("+15559876543");
    expect(geo.handleAsync).toHaveBeenCalledWith({
      keys: [{ contextKey: "auth:contact", relatedEntityId: "contact-42" }],
    });
  });

  it("should handle contact with no contactMethods", async () => {
    const contacts = new Map();
    contacts.set("auth:user:user-no-methods", [
      {
        id: "c2",
        contextKey: "auth:user",
        relatedEntityId: "user-no-methods",
        contactMethods: undefined,
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
    ]);

    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: contacts } })),
    };

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-no-methods" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should resolve phone-only when email not available", async () => {
    const contacts = new Map();
    contacts.set("auth:user:user-phone", [
      {
        id: "c3",
        contextKey: "auth:user",
        relatedEntityId: "user-phone",
        contactMethods: {
          emails: [],
          phoneNumbers: [{ value: "+15551111111", labels: [] }],
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-phone" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBe("+15551111111");
  });

  it("should pick first email/phone from multiple contacts", async () => {
    const contacts = new Map();
    contacts.set("auth:user:user-multi", [
      {
        id: "c4",
        contextKey: "auth:user",
        relatedEntityId: "user-multi",
        contactMethods: {
          emails: [],
          phoneNumbers: [],
        },
        personalDetails: undefined,
        professionalDetails: undefined,
        location: undefined,
        createdAt: new Date(),
      },
      {
        id: "c5",
        contextKey: "auth:user",
        relatedEntityId: "user-multi",
        contactMethods: {
          emails: [{ value: "second@example.com", labels: [] }],
          phoneNumbers: [{ value: "+15552222222", labels: [] }],
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-multi" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("second@example.com");
    expect(result.data!.phone).toBe("+15552222222");
  });

  it("should prefer userId over contactId when both provided", async () => {
    const contacts = new Map();
    contacts.set("auth:user:user-both", [
      {
        id: "c6",
        contextKey: "auth:user",
        relatedEntityId: "user-both",
        contactMethods: {
          emails: [{ value: "user@both.com", labels: [] }],
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({
      userId: "user-both",
      contactId: "contact-ignored",
    });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("user@both.com");
    // Should have used auth:user context key, not auth:contact
    expect(geo.handleAsync).toHaveBeenCalledWith({
      keys: [{ contextKey: "auth:user", relatedEntityId: "user-both" }],
    });
  });

  it("should handle geo returning ok with no data field", async () => {
    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({})),
    };

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-no-data" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });
});
