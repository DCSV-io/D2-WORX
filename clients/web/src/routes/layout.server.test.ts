import { describe, it, expect } from "vitest";
import { load } from "./+layout.server";

const fakeUrl = { pathname: "/" } as URL;

describe("root +layout.server.ts", () => {
  it("should return null session and user when locals are empty", async () => {
    const result = await load({
      locals: {},
      url: fakeUrl,
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
      url: fakeUrl,
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
      url: fakeUrl,
    } as any);

    expect(result).toEqual({
      session: null,
      user,
    });
  });
});
