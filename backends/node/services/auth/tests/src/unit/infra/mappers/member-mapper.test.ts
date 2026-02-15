import { describe, it, expect } from "vitest";
import { toDomainMember } from "@d2/auth-infra";

describe("toDomainMember", () => {
  it("should map camelCase member to domain Member", () => {
    const raw = {
      id: "mem-123",
      userId: "user-456",
      organizationId: "org-789",
      role: "officer",
      createdAt: new Date("2026-01-15"),
    };

    const member = toDomainMember(raw);

    expect(member.id).toBe("mem-123");
    expect(member.userId).toBe("user-456");
    expect(member.organizationId).toBe("org-789");
    expect(member.role).toBe("officer");
    expect(member.createdAt).toEqual(new Date("2026-01-15"));
  });

  it("should map snake_case fields", () => {
    const raw = {
      id: "mem-456",
      user_id: "user-789",
      organization_id: "org-abc",
      role: "auditor",
      created_at: "2026-02-01T00:00:00Z",
    };

    const member = toDomainMember(raw);

    expect(member.userId).toBe("user-789");
    expect(member.organizationId).toBe("org-abc");
    expect(member.role).toBe("auditor");
  });

  it("should default role to agent when missing", () => {
    const raw = {
      id: "mem-789",
      userId: "user-1",
      organizationId: "org-1",
      createdAt: new Date(),
    };

    const member = toDomainMember(raw);
    expect(member.role).toBe("agent");
  });
});
