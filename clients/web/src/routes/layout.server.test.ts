import { describe, it, expect } from "vitest";
import { load } from "./+layout.server";

describe("root +layout.server.ts", () => {
  it("should return null session and user when locals are empty", async () => {
    const result = await load({
      locals: {},
    } as any);

    expect(result).toEqual({
      session: null,
      user: null,
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
    });
  });
});
