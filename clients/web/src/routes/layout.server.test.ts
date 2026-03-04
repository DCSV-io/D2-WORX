import { describe, it, expect } from "vitest";
import { load } from "./+layout.server";

describe("root +layout.server.ts", () => {
  it("should return null session, user, and clientFingerprint when locals are empty", async () => {
    const result = await load({
      locals: {},
    } as any);

    expect(result).toEqual({
      session: null,
      user: null,
      clientFingerprint: null,
    });
  });

  it("should pass through session from locals when present", async () => {
    const session = {
      userId: "user-123",
      activeOrganizationId: "org-456",
      activeOrganizationType: "customer",
      activeOrganizationRole: "owner",
    };

    const result = await load({
      locals: { session },
    } as any);

    expect(result).toEqual({
      session,
      user: null,
      clientFingerprint: null,
    });
  });

  it("should pass through user from locals when present", async () => {
    const user = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    };

    const result = await load({
      locals: { user },
    } as any);

    expect(result).toEqual({
      session: null,
      user,
      clientFingerprint: null,
    });
  });

  it("should pass through clientFingerprint from requestInfo", async () => {
    const result = await load({
      locals: {
        requestInfo: {
          serverFingerprint: "abc123def456",
          clientIp: "127.0.0.1",
        },
      },
    } as any);

    expect(result).toEqual({
      session: null,
      user: null,
      clientFingerprint: "abc123def456",
    });
  });

  it("should return null clientFingerprint when requestInfo has no serverFingerprint", async () => {
    const result = await load({
      locals: {
        requestInfo: {
          clientIp: "127.0.0.1",
        },
      },
    } as any);

    expect(result).toEqual({
      session: null,
      user: null,
      clientFingerprint: null,
    });
  });
});
