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
    expect(deliverInput.sensitive).toBe(false);
    expect(deliverInput.channels).toEqual(["email"]);
    expect(deliverInput.templateName).toBe("invitation");
    expect(deliverInput.content).toContain("Acme Corp");
    expect(deliverInput.content).toContain("agent");
    expect(deliverInput.correlationId).toBeDefined();
  });

  it("should pass inviteeEmail as recipientContactId (known Stage C gap)", async () => {
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
    });

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    // Bug 3: email is passed where contactId is expected — tracked as Stage C TODO
    expect(deliverInput.recipientContactId).toBe("invitee@example.com");
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
