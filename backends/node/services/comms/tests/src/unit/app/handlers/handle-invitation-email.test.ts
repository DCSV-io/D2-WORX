import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { HandleInvitationEmail } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("HandleInvitationEmail", () => {
  it("should call Deliver with correct parameters", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-123",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept?id=inv-123",
    });

    expect(result.success).toBe(true);
    expect(mockDeliver.handleAsync).toHaveBeenCalledOnce();

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    expect(deliverInput.senderService).toBe("auth");
    expect(deliverInput.sensitive).toBe(true);
    expect(deliverInput.channels).toEqual(["email"]);
    expect(deliverInput.templateName).toBe("invitation");
    expect(deliverInput.content).toContain("Acme Corp");
    expect(deliverInput.content).toContain("agent");
    expect(deliverInput.correlationId).toBeDefined();
  });

  it("should pass inviteeUserId when set", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-123",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept?id=inv-123",
      inviteeUserId: "user-abc",
    });

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    expect(deliverInput.recipientUserId).toBe("user-abc");
    expect(deliverInput.recipientContactId).toBeUndefined();
  });

  it("should pass inviteeContactId when set", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-123",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept?id=inv-123",
      inviteeContactId: "contact-xyz",
    });

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    expect(deliverInput.recipientContactId).toBe("contact-xyz");
    expect(deliverInput.recipientUserId).toBeUndefined();
  });

  it("should propagate Deliver failure", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(D2Result.fail({ messages: ["Delivery failed"], statusCode: 502 })),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-123",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept?id=inv-123",
    });

    expect(result.success).toBe(false);
  });

  it("should propagate DELIVERY_FAILED error code via bubbleFail", async () => {
    const mockDeliver = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed for 1 channel(s), retry scheduled."],
          statusCode: 503,
          errorCode: "DELIVERY_FAILED",
        }),
      ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-123",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept?id=inv-123",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("DELIVERY_FAILED");
    expect(result.statusCode).toBe(503);
  });

  // -------------------------------------------------------------------------
  // Defensive / Security tests
  // -------------------------------------------------------------------------

  it("should handle empty organizationName without crashing", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-empty",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
    });

    expect(result.success).toBe(true);
    // Should not crash — content will have "invited to " with empty org name
    const input = mockDeliver.handleAsync.mock.calls[0][0];
    expect(input.title).toBe("You've been invited to ");
  });

  it("should handle empty inviterName without crashing", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-noname",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme",
      role: "agent",
      inviterName: "",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
    });

    expect(result.success).toBe(true);
    const input = mockDeliver.handleAsync.mock.calls[0][0];
    expect(input.content).toContain("(jane@example.com)");
  });

  it("should handle neither userId nor contactId set (both undefined)", async () => {
    const mockDeliver = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["Failed to resolve recipient address."], statusCode: 503 }),
      ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      invitationId: "inv-orphan",
      inviteeEmail: "orphan@example.com",
      organizationId: "org-1",
      organizationName: "Acme",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
      // Neither inviteeUserId nor inviteeContactId set
    });

    // Deliver will get no recipient and should fail
    expect(result.success).toBe(false);
    const input = mockDeliver.handleAsync.mock.calls[0][0];
    expect(input.recipientUserId).toBeUndefined();
    expect(input.recipientContactId).toBeUndefined();
  });

  it("should always set sensitive to true", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      invitationId: "inv-sensitive",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://example.com/accept",
    });

    const input = mockDeliver.handleAsync.mock.calls[0][0];
    expect(input.sensitive).toBe(true);
  });

  it("should escape javascript: URL in invitationUrl (XSS prevention)", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      invitationId: "inv-xss-url",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme",
      role: "agent",
      inviterName: "Jane",
      inviterEmail: "jane@example.com",
      invitationUrl: 'javascript:alert("xss")',
    });

    const input = mockDeliver.handleAsync.mock.calls[0][0];
    // escapeHtml should escape the quotes, making the javascript: URL non-executable in href
    expect(input.content).not.toContain('javascript:alert("xss")');
    expect(input.content).toContain("javascript:alert");
    // Plain text doesn't escape — but it's not rendered as HTML
    expect(input.plainTextContent).toContain('javascript:alert("xss")');
  });

  it("should generate unique correlationId per invocation", async () => {
    const correlationIds: string[] = [];
    const mockDeliver = {
      handleAsync: vi.fn().mockImplementation((input: { correlationId: string }) => {
        correlationIds.push(input.correlationId);
        return D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } });
      }),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    const baseInput = {
      invitationId: "inv-1",
      inviteeEmail: "i@e.com",
      organizationId: "o",
      organizationName: "O",
      role: "agent",
      inviterName: "J",
      inviterEmail: "j@e.com",
      invitationUrl: "https://e.com",
    };

    await handler.handleAsync(baseInput);
    await handler.handleAsync(baseInput);

    expect(correlationIds).toHaveLength(2);
    expect(correlationIds[0]).not.toBe(correlationIds[1]);
  });

  it("should escape HTML in content but not in plainTextContent", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleInvitationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      invitationId: "inv-xss",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-xss",
      organizationName: '<script>alert("xss")</script>',
      role: "agent",
      inviterName: "Evil<User>",
      inviterEmail: "evil@example.com",
      invitationUrl: "https://example.com/accept?id=inv-xss",
    });

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];

    // HTML content should have escaped org name and inviter name
    expect(deliverInput.content).toContain("&lt;script&gt;");
    expect(deliverInput.content).not.toContain("<script>");
    expect(deliverInput.content).toContain("Evil&lt;User&gt;");
    expect(deliverInput.content).not.toContain("Evil<User>");

    // Plain text content should NOT be escaped
    expect(deliverInput.plainTextContent).toContain('<script>alert("xss")</script>');
    expect(deliverInput.plainTextContent).toContain("Evil<User>");
  });
});
