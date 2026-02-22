import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { D2Result, HttpStatusCode } from "@d2/result";
import { IPublishInvitationEmailKey } from "@d2/auth-app";
import { ICreateContactsKey } from "@d2/geo-client";
import { createInvitationRoutes, SCOPE_KEY } from "@d2/auth-api";

// ---------- Mock helpers ----------

const mockCreateInvitation = vi.fn();
const mockAuth = {
  api: { createInvitation: mockCreateInvitation },
} as never;

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockDb = {
  select: mockSelect,
  // Chain: db.select().from().where().limit()
} as never;

function resetDbChain(userRows: Array<{ id: string }> = [], orgRows: Array<{ name: string }> = []) {
  // Track which call number we're on so user lookup vs org lookup return different rows
  let selectCallCount = 0;
  mockSelect.mockImplementation(() => {
    selectCallCount++;
    const currentCall = selectCallCount;
    return {
      from: () => ({
        where: () => ({
          limit: () => {
            // Calls 1 = user lookup, 2 = org lookup
            return currentCall === 1 ? Promise.resolve(userRows) : Promise.resolve(orgRows);
          },
        }),
      }),
    };
  });
}

function createMockHandlers() {
  return {
    createContacts: {
      handleAsync: vi
        .fn()
        .mockResolvedValue(D2Result.ok({ data: { data: [{ id: "geo-contact-1" }] } })),
    },
    publishInvitation: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    },
  };
}

function createMockScope(handlers: ReturnType<typeof createMockHandlers>) {
  const keyMap = new Map<string, unknown>([
    [ICreateContactsKey.id, handlers.createContacts],
    [IPublishInvitationEmailKey.id, handlers.publishInvitation],
  ]);
  return {
    resolve: (key: { id: string }) => {
      const handler = keyMap.get(key.id);
      if (!handler) throw new Error(`No mock handler for key: ${key.id}`);
      return handler;
    },
  };
}

function createTestApp(
  handlers: ReturnType<typeof createMockHandlers>,
  session: {
    activeOrganizationId?: string;
    activeOrganizationType?: string;
    activeOrganizationRole?: string;
  } = {},
) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.set(
      "user" as never,
      {
        id: "user-inviter",
        email: "inviter@example.com",
        name: "The Inviter",
      } as never,
    );
    c.set(
      "session" as never,
      {
        activeOrganizationId: session.activeOrganizationId ?? "org-1",
        activeOrganizationType: session.activeOrganizationType ?? "customer",
        activeOrganizationRole: session.activeOrganizationRole ?? "officer",
      } as never,
    );
    c.set(SCOPE_KEY as never, createMockScope(handlers) as never);
    await next();
  });

  app.route("/", createInvitationRoutes(mockAuth, mockDb, "https://app.example.com"));
  return app;
}

const BASE_BODY = {
  email: "invitee@example.com",
  role: "agent",
  firstName: "Jane",
  lastName: "Doe",
};

describe("Invitation routes", () => {
  let handlers: ReturnType<typeof createMockHandlers>;

  beforeEach(() => {
    handlers = createMockHandlers();
    mockCreateInvitation.mockResolvedValue({ id: "inv-abc" });
    resetDbChain([], [{ name: "Acme Corp" }]);
  });

  // -------------------------------------------------------------------------
  // Role checks
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — role checks", () => {
    it("should reject auditor role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "auditor" });
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });
      expect(res.status).toBe(403);
      expect(handlers.publishInvitation.handleAsync).not.toHaveBeenCalled();
    });

    it("should reject agent role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "agent" });
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });
      expect(res.status).toBe(403);
    });

    it("should allow officer role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "officer" });
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });
      expect(res.status).toBe(201);
    });

    it("should allow owner role", async () => {
      const app = createTestApp(handlers, { activeOrganizationRole: "owner" });
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });
      expect(res.status).toBe(201);
    });

    it("should reject when no active org", async () => {
      const app = new Hono();
      app.use("*", async (c, next) => {
        c.set(
          "user" as never,
          {
            id: "user-1",
            email: "u@e.com",
            name: "U",
          } as never,
        );
        c.set("session" as never, {} as never); // No org fields
        c.set(SCOPE_KEY as never, createMockScope(handlers) as never);
        await next();
      });
      app.route("/", createInvitationRoutes(mockAuth, mockDb, "https://app.example.com"));

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — validation", () => {
    it("should return 400 when email is missing", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "agent" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { inputErrors?: string[][] };
      expect(body.inputErrors).toBeDefined();
      expect(body.inputErrors!.some((e: string[]) => e[0] === "email")).toBe(true);
    });

    it("should return 400 when role is missing", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "test@test.com" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { inputErrors?: string[][] };
      expect(body.inputErrors!.some((e: string[]) => e[0] === "role")).toBe(true);
    });

    it("should return 400 when both email and role are missing", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { inputErrors?: string[][] };
      expect(body.inputErrors).toHaveLength(2);
    });

    it("should trim whitespace from email", async () => {
      const app = createTestApp(handlers);
      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "  trimmed@test.com  ", role: "agent" }),
      });
      // Should call createInvitation with trimmed email
      expect(mockCreateInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ email: "trimmed@test.com" }),
        }),
      );
    });

    it("should treat whitespace-only email as missing", async () => {
      const app = createTestApp(handlers);
      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "   ", role: "agent" }),
      });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — non-existing user (contactId path)
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — non-existing user", () => {
    it("should create Geo contact and publish with contactId", async () => {
      resetDbChain([], [{ name: "Acme Corp" }]); // No user found, org found
      const app = createTestApp(handlers);

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "agent",
          firstName: "New",
          lastName: "User",
          phone: "+15551234567",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { data?: { invitationId: string } };
      expect(body.data?.invitationId).toBe("inv-abc");

      // Should have called createContacts
      expect(handlers.createContacts.handleAsync).toHaveBeenCalledOnce();
      const contactInput = handlers.createContacts.handleAsync.mock.calls[0][0];
      expect(contactInput.contacts).toHaveLength(1);
      expect(contactInput.contacts[0].contextKey).toBe("auth_org_invitation");
      expect(contactInput.contacts[0].relatedEntityId).toBe("inv-abc");
      expect(contactInput.contacts[0].personalDetails.firstName).toBe("New");
      expect(contactInput.contacts[0].personalDetails.lastName).toBe("User");
      expect(contactInput.contacts[0].contactMethods.emails[0].value).toBe("newuser@example.com");
      expect(contactInput.contacts[0].contactMethods.phoneNumbers[0].value).toBe("+15551234567");

      // Should publish with contactId, not userId
      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          invitationId: "inv-abc",
          inviteeContactId: "geo-contact-1",
          inviteeUserId: undefined,
          organizationName: "Acme Corp",
        }),
      );
    });

    it("should omit phoneNumbers array when phone not provided", async () => {
      resetDbChain([], [{ name: "Acme" }]);
      const app = createTestApp(handlers);

      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", role: "agent" }),
      });

      const contactInput = handlers.createContacts.handleAsync.mock.calls[0][0];
      expect(contactInput.contacts[0].contactMethods.phoneNumbers).toEqual([]);
    });

    it("should still publish even when Geo contact creation fails", async () => {
      resetDbChain([], [{ name: "Acme" }]);
      handlers.createContacts.handleAsync.mockResolvedValue(
        D2Result.fail({ messages: ["Geo unavailable"] }),
      );
      const app = createTestApp(handlers);

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(res.status).toBe(201);
      // Publish should still be called but with undefined contactId
      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteeContactId: undefined,
          inviteeUserId: undefined,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — existing user (userId path)
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — existing user", () => {
    it("should skip Geo contact creation and publish with userId", async () => {
      resetDbChain([{ id: "existing-user-id" }], [{ name: "Acme Corp" }]);
      const app = createTestApp(handlers);

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "existing@example.com", role: "officer" }),
      });

      expect(res.status).toBe(201);

      // Should NOT create Geo contact
      expect(handlers.createContacts.handleAsync).not.toHaveBeenCalled();

      // Should publish with userId, not contactId
      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteeUserId: "existing-user-id",
          inviteeContactId: undefined,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // BetterAuth createInvitation failure
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — createInvitation failure", () => {
    it("should return 400 when createInvitation throws an Error", async () => {
      mockCreateInvitation.mockRejectedValue(new Error("User is already a member."));
      const app = createTestApp(handlers);

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { messages?: string[] };
      expect(body.messages).toContain("User is already a member.");

      // Should not attempt to publish
      expect(handlers.publishInvitation.handleAsync).not.toHaveBeenCalled();
    });

    it("should return generic message for non-Error throws", async () => {
      mockCreateInvitation.mockRejectedValue("string error");
      const app = createTestApp(handlers);

      const res = await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { messages?: string[] };
      expect(body.messages).toContain("Failed to create invitation.");
    });
  });

  // -------------------------------------------------------------------------
  // Org name lookup
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — org name fallback", () => {
    it("should fall back to 'the organization' when org not found", async () => {
      resetDbChain([], []); // No user, no org
      const app = createTestApp(handlers);

      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ organizationName: "the organization" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Publish event shape
  // -------------------------------------------------------------------------

  describe("POST /api/invitations — publish event", () => {
    it("should include invitation URL with baseUrl + invitationId", async () => {
      const app = createTestApp(handlers);

      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          invitationUrl:
            "https://app.example.com/api/auth/organization/accept-invitation?invitationId=inv-abc",
        }),
      );
    });

    it("should use inviter name from session user, falling back to 'Someone'", async () => {
      const app = new Hono();
      app.use("*", async (c, next) => {
        c.set(
          "user" as never,
          {
            id: "user-no-name",
            email: "noname@e.com",
            name: undefined,
          } as never,
        );
        c.set(
          "session" as never,
          {
            activeOrganizationId: "org-1",
            activeOrganizationType: "customer",
            activeOrganizationRole: "officer",
          } as never,
        );
        c.set(SCOPE_KEY as never, createMockScope(handlers) as never);
        await next();
      });
      app.route("/", createInvitationRoutes(mockAuth, mockDb, "https://app.example.com"));

      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BASE_BODY),
      });

      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ inviterName: "Someone" }),
      );
    });

    it("should pass all expected fields to publisher", async () => {
      resetDbChain([{ id: "u-existing" }], [{ name: "Test Org" }]);
      const app = createTestApp(handlers);

      await app.request("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "invitee@example.com", role: "auditor" }),
      });

      expect(handlers.publishInvitation.handleAsync).toHaveBeenCalledWith({
        invitationId: "inv-abc",
        inviteeEmail: "invitee@example.com",
        organizationId: "org-1",
        organizationName: "Test Org",
        role: "auditor",
        inviterName: "The Inviter",
        inviterEmail: "inviter@example.com",
        invitationUrl: expect.stringContaining("inv-abc"),
        inviteeUserId: "u-existing",
        inviteeContactId: undefined,
      });
    });
  });
});
