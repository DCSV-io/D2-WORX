import { describe, it, expect } from "vitest";
import { requireAuth, requireOrg, redirectIfAuthenticated } from "../route-guard.js";
import type { AuthSession, AuthUser } from "../types.js";

const mockSession: AuthSession = {
  userId: "user-1",
  activeOrganizationId: "org-1",
  activeOrganizationType: "customer",
  activeOrganizationRole: "owner",
  emulatedOrganizationId: null,
  emulatedOrganizationType: null,
};

const mockUser: AuthUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  username: "testuser",
  displayUsername: "TestUser",
  image: null,
};

const noOrgSession: AuthSession = {
  userId: "user-2",
  activeOrganizationId: null,
  activeOrganizationType: null,
  activeOrganizationRole: null,
  emulatedOrganizationId: null,
  emulatedOrganizationType: null,
};

describe("requireAuth", () => {
  it("should throw redirect when no session", () => {
    expect(() => requireAuth({ session: null, user: null })).toThrow();
    try {
      requireAuth({ session: null, user: null });
    } catch (e: unknown) {
      // SvelteKit redirect throws an object with status and location
      const err = e as { status: number; location: string };
      expect(err.status).toBe(303);
      expect(err.location).toBe("/sign-in");
    }
  });

  it("should return session and user when authenticated", () => {
    const result = requireAuth({ session: mockSession, user: mockUser });

    expect(result.session).toEqual(mockSession);
    expect(result.user).toEqual(mockUser);
  });

  it("should throw redirect when session is undefined", () => {
    expect(() => requireAuth({})).toThrow();
  });
});

describe("requireOrg", () => {
  it("should throw redirect to /sign-in when no session", () => {
    try {
      requireOrg({ session: null, user: null });
    } catch (e: unknown) {
      const err = e as { status: number; location: string };
      expect(err.status).toBe(303);
      expect(err.location).toBe("/sign-in");
    }
  });

  it("should throw redirect to /welcome when no active org", () => {
    try {
      requireOrg({ session: noOrgSession, user: mockUser });
    } catch (e: unknown) {
      const err = e as { status: number; location: string };
      expect(err.status).toBe(303);
      expect(err.location).toBe("/welcome");
    }
  });

  it("should return session with org data when authenticated with org", () => {
    const result = requireOrg({ session: mockSession, user: mockUser });

    expect(result.session.activeOrganizationId).toBe("org-1");
    expect(result.session.activeOrganizationType).toBe("customer");
    expect(result.session.activeOrganizationRole).toBe("owner");
    expect(result.user).toEqual(mockUser);
  });
});

describe("redirectIfAuthenticated", () => {
  it("should throw redirect to /dashboard when signed in", () => {
    try {
      redirectIfAuthenticated({ session: mockSession, user: mockUser });
    } catch (e: unknown) {
      const err = e as { status: number; location: string };
      expect(err.status).toBe(303);
      expect(err.location).toBe("/dashboard");
    }
  });

  it("should throw redirect to custom URL when signed in", () => {
    try {
      redirectIfAuthenticated({ session: mockSession, user: mockUser }, "/home");
    } catch (e: unknown) {
      const err = e as { status: number; location: string };
      expect(err.status).toBe(303);
      expect(err.location).toBe("/home");
    }
  });

  it("should not throw when not signed in", () => {
    expect(() => redirectIfAuthenticated({ session: null, user: null })).not.toThrow();
  });

  it("should not throw when session is undefined", () => {
    expect(() => redirectIfAuthenticated({})).not.toThrow();
  });
});
