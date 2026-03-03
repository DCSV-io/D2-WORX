import { describe, it, expect } from "vitest";
import { load } from "./+layout.server";

describe("(app) +layout.server.ts", () => {
  function makeEvent(session: Record<string, unknown> | null = null) {
    return {
      parent: async () => ({ session, user: null }),
    } as any;
  }

  it("should return default orgType and role when session is null", async () => {
    const result = await load(makeEvent());

    expect(result).toEqual({
      orgType: "customer",
      role: "owner",
    });
  });

  it("should derive orgType from session when present", async () => {
    const result = await load(
      makeEvent({
        userId: "user-123",
        activeOrganizationType: "support",
        activeOrganizationRole: "officer",
      }),
    );

    expect(result).toEqual({
      orgType: "support",
      role: "officer",
    });
  });

  it("should fall back to defaults when session fields are missing", async () => {
    const result = await load(
      makeEvent({
        userId: "user-123",
      }),
    );

    expect(result).toEqual({
      orgType: "customer",
      role: "owner",
    });
  });
});
