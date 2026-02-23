import { describe, it, expect } from "vitest";
import { AUTH_EVENT_REGISTRY, matchEvent } from "@d2/comms-app";
import { IHandleVerificationEmailKey, IHandlePasswordResetKey, IHandleInvitationEmailKey } from "@d2/comms-app";

describe("AUTH_EVENT_REGISTRY", () => {
  it("should have exactly 3 entries", () => {
    expect(AUTH_EVENT_REGISTRY).toHaveLength(3);
  });

  it("should contain VerificationEmail, PasswordReset, InvitationEmail event types", () => {
    const eventTypes = AUTH_EVENT_REGISTRY.map((r) => r.eventType);
    expect(eventTypes).toContain("VerificationEmail");
    expect(eventTypes).toContain("PasswordReset");
    expect(eventTypes).toContain("InvitationEmail");
  });

  it("should map to the correct ServiceKeys", () => {
    const verifyReg = AUTH_EVENT_REGISTRY.find((r) => r.eventType === "VerificationEmail")!;
    const resetReg = AUTH_EVENT_REGISTRY.find((r) => r.eventType === "PasswordReset")!;
    const inviteReg = AUTH_EVENT_REGISTRY.find((r) => r.eventType === "InvitationEmail")!;

    expect(verifyReg.handlerKey.id).toBe(IHandleVerificationEmailKey.id);
    expect(resetReg.handlerKey.id).toBe(IHandlePasswordResetKey.id);
    expect(inviteReg.handlerKey.id).toBe(IHandleInvitationEmailKey.id);
  });
});

describe("matchEvent — detection", () => {
  it("should detect verification email by 'verificationUrl' field", () => {
    const result = matchEvent({
      userId: "u1",
      email: "a@b.com",
      name: "A",
      verificationUrl: "https://example.com/verify",
      token: "t",
    });

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("VerificationEmail");
  });

  it("should detect password reset by 'resetUrl' field", () => {
    const result = matchEvent({
      userId: "u1",
      email: "a@b.com",
      name: "A",
      resetUrl: "https://example.com/reset",
      token: "t",
    });

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("PasswordReset");
  });

  it("should detect invitation email by 'invitationUrl' field", () => {
    const result = matchEvent({
      invitationId: "inv-1",
      inviteeEmail: "a@b.com",
      organizationId: "org-1",
      organizationName: "Acme",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@b.com",
      invitationUrl: "https://example.com/accept",
    });

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("InvitationEmail");
  });

  it("should return null for unknown event shapes", () => {
    expect(matchEvent({ userId: "u1", someUnknownField: "value" })).toBeNull();
  });

  it("should return null for empty body", () => {
    expect(matchEvent({})).toBeNull();
  });

  it("should return null when discriminant field name is close but misspelled", () => {
    // 'verifyUrl' instead of 'verificationUrl'
    expect(matchEvent({ userId: "u1", verifyUrl: "https://example.com" })).toBeNull();
    // 'reset_url' instead of 'resetUrl'
    expect(matchEvent({ userId: "u1", reset_url: "https://example.com" })).toBeNull();
    // 'invitation_url' instead of 'invitationUrl'
    expect(matchEvent({ invitationId: "i", invitation_url: "https://example.com" })).toBeNull();
  });

  it("should match first entry when body has multiple discriminant fields", () => {
    // Body has both verificationUrl and resetUrl — registry order means VerificationEmail wins
    const result = matchEvent({
      userId: "u1",
      verificationUrl: "https://verify",
      resetUrl: "https://reset",
    });

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("VerificationEmail");
  });

  it("should match first entry when body has both verificationUrl and invitationUrl", () => {
    const result = matchEvent({
      verificationUrl: "https://verify",
      invitationUrl: "https://accept",
    });

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe("VerificationEmail");
  });
});

describe("matchEvent — deserialization", () => {
  it("should deserialize verification email event with correct fields", () => {
    const registration = matchEvent({
      userId: "user-1",
      email: "test@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify/abc",
      token: "abc",
    })!;

    const event = registration.deserialize({
      userId: "user-1",
      email: "test@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify/abc",
      token: "abc",
    }) as Record<string, unknown>;

    expect(event.userId).toBe("user-1");
    expect(event.email).toBe("test@example.com");
    expect(event.name).toBe("Test User");
    expect(event.verificationUrl).toBe("https://example.com/verify/abc");
    expect(event.token).toBe("abc");
  });

  it("should deserialize password reset event with correct fields", () => {
    const registration = matchEvent({
      userId: "user-2",
      email: "reset@example.com",
      name: "Reset User",
      resetUrl: "https://example.com/reset/xyz",
      token: "xyz",
    })!;

    const event = registration.deserialize({
      userId: "user-2",
      email: "reset@example.com",
      name: "Reset User",
      resetUrl: "https://example.com/reset/xyz",
      token: "xyz",
    }) as Record<string, unknown>;

    expect(event.userId).toBe("user-2");
    expect(event.resetUrl).toBe("https://example.com/reset/xyz");
  });

  it("should deserialize invitation email event with correct fields", () => {
    const registration = matchEvent({
      invitationId: "inv-1",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
    })!;

    const event = registration.deserialize({
      invitationId: "inv-1",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
    }) as Record<string, unknown>;

    expect(event.invitationId).toBe("inv-1");
    expect(event.organizationName).toBe("Acme Corp");
    expect(event.invitationUrl).toBe("https://example.com/accept");
  });

  it("should produce default values for missing optional proto fields", () => {
    const registration = matchEvent({
      userId: "",
      verificationUrl: "",
    })!;

    // Proto fromJSON fills in defaults for missing fields
    const event = registration.deserialize({
      verificationUrl: "https://example.com/verify",
    }) as Record<string, unknown>;

    // userId should default to empty string (proto default)
    expect(event.userId).toBe("");
    expect(event.verificationUrl).toBe("https://example.com/verify");
  });
});
