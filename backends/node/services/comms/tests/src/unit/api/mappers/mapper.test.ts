import { describe, it, expect } from "vitest";
import type { ChannelPreference, TemplateWrapper, DeliveryRequest, DeliveryAttempt } from "@d2/comms-domain";
import {
  channelPreferenceToProto,
  templateWrapperToProto,
  deliveryRequestToProto,
  deliveryAttemptToProto,
} from "@d2/comms-api";

describe("channelPreferenceToProto", () => {
  it("should map all fields for a full preference", () => {
    const pref: ChannelPreference = {
      id: "pref-1",
      userId: "user-1",
      contactId: "contact-1",
      emailEnabled: true,
      smsEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      quietHoursTz: "America/New_York",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-15T00:00:00Z",
    };

    const result = channelPreferenceToProto(pref);

    expect(result.id).toBe("pref-1");
    expect(result.userId).toBe("user-1");
    expect(result.contactId).toBe("contact-1");
    expect(result.emailEnabled).toBe(true);
    expect(result.smsEnabled).toBe(false);
    expect(result.quietHoursStart).toBe("22:00");
    expect(result.quietHoursEnd).toBe("08:00");
    expect(result.quietHoursTz).toBe("America/New_York");
    expect(result.createdAt).toBe("2026-01-01T00:00:00Z");
    expect(result.updatedAt).toBe("2026-01-15T00:00:00Z");
  });

  it("should map nullable fields to undefined", () => {
    const pref: ChannelPreference = {
      id: "pref-2",
      userId: null,
      contactId: null,
      emailEnabled: true,
      smsEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTz: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const result = channelPreferenceToProto(pref);

    expect(result.userId).toBeUndefined();
    expect(result.contactId).toBeUndefined();
    expect(result.quietHoursStart).toBeUndefined();
    expect(result.quietHoursEnd).toBeUndefined();
    expect(result.quietHoursTz).toBeUndefined();
  });
});

describe("templateWrapperToProto", () => {
  it("should map all fields for a full template", () => {
    const tpl: TemplateWrapper = {
      id: "tpl-1",
      name: "email-verification",
      channel: "email",
      subjectTemplate: "Verify your email",
      bodyTemplate: "<p>Hi {{name}}</p>",
      active: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const result = templateWrapperToProto(tpl);

    expect(result.id).toBe("tpl-1");
    expect(result.name).toBe("email-verification");
    expect(result.channel).toBe("email");
    expect(result.subjectTemplate).toBe("Verify your email");
    expect(result.bodyTemplate).toBe("<p>Hi {{name}}</p>");
    expect(result.active).toBe(true);
  });

  it("should map null subjectTemplate to undefined", () => {
    const tpl: TemplateWrapper = {
      id: "tpl-2",
      name: "sms-otp",
      channel: "sms",
      subjectTemplate: null,
      bodyTemplate: "Your code: {{code}}",
      active: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    const result = templateWrapperToProto(tpl);

    expect(result.subjectTemplate).toBeUndefined();
  });
});

describe("deliveryRequestToProto", () => {
  it("should map all fields for a full request", () => {
    const req: DeliveryRequest = {
      id: "req-1",
      messageId: "msg-1",
      correlationId: "corr-1",
      recipientUserId: "user-1",
      recipientContactId: "contact-1",
      channels: ["email", "sms"],
      templateName: "password-reset",
      callbackTopic: "callbacks.delivery",
      createdAt: "2026-01-01T00:00:00Z",
      processedAt: "2026-01-01T00:01:00Z",
    };

    const result = deliveryRequestToProto(req);

    expect(result.id).toBe("req-1");
    expect(result.messageId).toBe("msg-1");
    expect(result.correlationId).toBe("corr-1");
    expect(result.recipientUserId).toBe("user-1");
    expect(result.recipientContactId).toBe("contact-1");
    expect(result.channels).toEqual(["email", "sms"]);
    expect(result.templateName).toBe("password-reset");
    expect(result.callbackTopic).toBe("callbacks.delivery");
    expect(result.processedAt).toBe("2026-01-01T00:01:00Z");
  });

  it("should map nullable fields to undefined and copy channels array", () => {
    const channels = ["email"];
    const req: DeliveryRequest = {
      id: "req-2",
      messageId: "msg-2",
      correlationId: "corr-2",
      recipientUserId: null,
      recipientContactId: null,
      channels,
      templateName: null,
      callbackTopic: null,
      createdAt: "2026-01-01T00:00:00Z",
      processedAt: null,
    };

    const result = deliveryRequestToProto(req);

    expect(result.recipientUserId).toBeUndefined();
    expect(result.recipientContactId).toBeUndefined();
    expect(result.templateName).toBeUndefined();
    expect(result.callbackTopic).toBeUndefined();
    expect(result.processedAt).toBeUndefined();
    // Verify channels array is copied (not same reference)
    expect(result.channels).toEqual(["email"]);
    expect(result.channels).not.toBe(channels);
  });
});

describe("deliveryAttemptToProto", () => {
  it("should map all fields for a full attempt", () => {
    const attempt: DeliveryAttempt = {
      id: "att-1",
      requestId: "req-1",
      channel: "email",
      recipientAddress: "user@example.com",
      status: "sent",
      providerMessageId: "resend-123",
      error: null,
      attemptNumber: 1,
      createdAt: "2026-01-01T00:00:00Z",
      nextRetryAt: null,
    };

    const result = deliveryAttemptToProto(attempt);

    expect(result.id).toBe("att-1");
    expect(result.requestId).toBe("req-1");
    expect(result.channel).toBe("email");
    expect(result.recipientAddress).toBe("user@example.com");
    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("resend-123");
    expect(result.attemptNumber).toBe(1);
  });

  it("should map nullable fields to undefined", () => {
    const attempt: DeliveryAttempt = {
      id: "att-2",
      requestId: "req-2",
      channel: "sms",
      recipientAddress: "+15551234567",
      status: "failed",
      providerMessageId: null,
      error: "Twilio timeout",
      attemptNumber: 3,
      createdAt: "2026-01-01T00:00:00Z",
      nextRetryAt: "2026-01-01T00:05:00Z",
    };

    const result = deliveryAttemptToProto(attempt);

    expect(result.providerMessageId).toBeUndefined();
    expect(result.error).toBe("Twilio timeout");
    expect(result.nextRetryAt).toBe("2026-01-01T00:05:00Z");
  });
});
