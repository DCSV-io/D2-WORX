import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { RecipientResolver } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("RecipientResolver", () => {
  it("should resolve email and phone from userId", async () => {
    const contacts = new Map();
    contacts.set("user:user-123", [
      {
        id: "c1",
        contextKey: "user",
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-123" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("user@example.com");
    expect(result.data!.phone).toBe("+15551234567");
  });

  it("should return empty when geo returns no contacts", async () => {
    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    };

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-999" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
    expect(result.data!.phone).toBeUndefined();
  });

  it("should return empty when neither userId nor contactId provided", async () => {
    const geo = { handleAsync: vi.fn() };
    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({});

    expect(result.success).toBe(true);
    expect(geo.handleAsync).not.toHaveBeenCalled();
  });

  it("should handle geo-client failure gracefully", async () => {
    const geo = {
      handleAsync: vi.fn().mockResolvedValue(D2Result.fail({ messages: ["Geo unavailable"] })),
    };

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-123" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBeUndefined();
  });

  it("should resolve email-only when phone not available", async () => {
    const contacts = new Map();
    contacts.set("user:user-456", [
      {
        id: "c2",
        contextKey: "user",
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

    const resolver = new RecipientResolver(geo as any, createMockContext());
    const result = await resolver.handleAsync({ userId: "user-456" });

    expect(result.success).toBe(true);
    expect(result.data!.email).toBe("only@email.com");
    expect(result.data!.phone).toBeUndefined();
  });
});
