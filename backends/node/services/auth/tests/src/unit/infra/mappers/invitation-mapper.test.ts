import { describe, it, expect } from "vitest";
import { toDomainInvitation } from "@d2/auth-infra";

describe("toDomainInvitation", () => {
  it("should map camelCase invitation to domain Invitation", () => {
    const raw = {
      id: "inv-123",
      email: "user@example.com",
      organizationId: "org-456",
      role: "officer",
      status: "accepted",
      inviterId: "user-789",
      expiresAt: new Date("2026-03-01"),
      createdAt: new Date("2026-02-01"),
    };

    const invitation = toDomainInvitation(raw);

    expect(invitation.id).toBe("inv-123");
    expect(invitation.email).toBe("user@example.com");
    expect(invitation.organizationId).toBe("org-456");
    expect(invitation.role).toBe("officer");
    expect(invitation.status).toBe("accepted");
    expect(invitation.inviterId).toBe("user-789");
    expect(invitation.expiresAt).toEqual(new Date("2026-03-01"));
    expect(invitation.createdAt).toEqual(new Date("2026-02-01"));
  });

  it("should map snake_case fields", () => {
    const raw = {
      id: "inv-456",
      email: "snake@example.com",
      organization_id: "org-789",
      role: "auditor",
      status: "pending",
      inviter_id: "user-abc",
      expires_at: "2026-04-01T00:00:00Z",
      created_at: "2026-02-15T00:00:00Z",
    };

    const invitation = toDomainInvitation(raw);

    expect(invitation.organizationId).toBe("org-789");
    expect(invitation.inviterId).toBe("user-abc");
    expect(invitation.role).toBe("auditor");
    expect(invitation.status).toBe("pending");
  });

  it("should default role to agent and status to pending when missing", () => {
    const raw = {
      id: "inv-789",
      email: "default@example.com",
      organizationId: "org-1",
      inviterId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
    };

    const invitation = toDomainInvitation(raw);
    expect(invitation.role).toBe("agent");
    expect(invitation.status).toBe("pending");
  });
});
