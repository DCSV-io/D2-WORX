import { describe, it, expect } from "vitest";
import { ChannelPreferenceDTOFns, DeliveryRequestDTOFns, DeliveryAttemptDTOFns } from "@d2/protos";

describe("Comms proto roundtrip tests", () => {
  describe("ChannelPreferenceDTO", () => {
    const sample = {
      id: "pref-001",
      contactId: "contact-001",
      emailEnabled: true,
      smsEnabled: false,
      createdAt: new Date("2026-01-15T10:00:00Z"),
      updatedAt: new Date("2026-01-20T15:30:00Z"),
    };

    it("should survive a JSON roundtrip", () => {
      const created = ChannelPreferenceDTOFns.fromPartial(sample);
      const json = ChannelPreferenceDTOFns.toJSON(created);
      const restored = ChannelPreferenceDTOFns.fromJSON(json);

      expect(restored.id).toBe(sample.id);
      expect(restored.contactId).toBe(sample.contactId);
      expect(restored.emailEnabled).toBe(true);
      expect(restored.smsEnabled).toBe(false);
    });

    it("should survive a binary encode/decode roundtrip", () => {
      const created = ChannelPreferenceDTOFns.fromPartial(sample);
      const bytes = ChannelPreferenceDTOFns.encode(created).finish();
      const decoded = ChannelPreferenceDTOFns.decode(bytes);

      expect(decoded.id).toBe(sample.id);
      expect(decoded.contactId).toBe(sample.contactId);
      expect(decoded.emailEnabled).toBe(true);
      expect(decoded.smsEnabled).toBe(false);
    });
  });

  describe("DeliveryRequestDTO", () => {
    const sample = {
      id: "req-001",
      messageId: "msg-001",
      correlationId: "corr-001",
      recipientContactId: "contact-002",
      callbackTopic: "callback.topic",
      createdAt: new Date("2026-02-01T08:00:00Z"),
      processedAt: new Date("2026-02-01T08:01:00Z"),
    };

    it("should survive a JSON roundtrip", () => {
      const created = DeliveryRequestDTOFns.fromPartial(sample);
      const json = DeliveryRequestDTOFns.toJSON(created);
      const restored = DeliveryRequestDTOFns.fromJSON(json);

      expect(restored.id).toBe(sample.id);
      expect(restored.messageId).toBe(sample.messageId);
      expect(restored.correlationId).toBe(sample.correlationId);
      expect(restored.recipientContactId).toBe(sample.recipientContactId);
      expect(restored.callbackTopic).toBe(sample.callbackTopic);
    });

    it("should survive a binary encode/decode roundtrip", () => {
      const created = DeliveryRequestDTOFns.fromPartial(sample);
      const bytes = DeliveryRequestDTOFns.encode(created).finish();
      const decoded = DeliveryRequestDTOFns.decode(bytes);

      expect(decoded.id).toBe(sample.id);
      expect(decoded.messageId).toBe(sample.messageId);
      expect(decoded.correlationId).toBe(sample.correlationId);
      expect(decoded.recipientContactId).toBe(sample.recipientContactId);
    });

    it("should handle optional callbackTopic as undefined", () => {
      const created = DeliveryRequestDTOFns.fromPartial({ ...sample, callbackTopic: undefined });
      const bytes = DeliveryRequestDTOFns.encode(created).finish();
      const decoded = DeliveryRequestDTOFns.decode(bytes);

      expect(decoded.callbackTopic).toBeUndefined();
    });
  });

  describe("DeliveryAttemptDTO", () => {
    const sample = {
      id: "att-001",
      requestId: "req-001",
      channel: "email",
      recipientAddress: "user@example.com",
      status: "sent",
      providerMessageId: "provider-msg-123",
      attemptNumber: 1,
      createdAt: new Date("2026-02-01T08:00:30Z"),
      nextRetryAt: undefined,
    };

    it("should survive a JSON roundtrip", () => {
      const created = DeliveryAttemptDTOFns.fromPartial(sample);
      const json = DeliveryAttemptDTOFns.toJSON(created);
      const restored = DeliveryAttemptDTOFns.fromJSON(json);

      expect(restored.id).toBe(sample.id);
      expect(restored.requestId).toBe(sample.requestId);
      expect(restored.channel).toBe(sample.channel);
      expect(restored.recipientAddress).toBe(sample.recipientAddress);
      expect(restored.status).toBe(sample.status);
      expect(restored.providerMessageId).toBe(sample.providerMessageId);
      expect(restored.attemptNumber).toBe(1);
    });

    it("should survive a binary encode/decode roundtrip", () => {
      const created = DeliveryAttemptDTOFns.fromPartial(sample);
      const bytes = DeliveryAttemptDTOFns.encode(created).finish();
      const decoded = DeliveryAttemptDTOFns.decode(bytes);

      expect(decoded.id).toBe(sample.id);
      expect(decoded.channel).toBe(sample.channel);
      expect(decoded.status).toBe(sample.status);
      expect(decoded.attemptNumber).toBe(1);
    });

    it("should handle failed attempt with error field", () => {
      const failed = {
        ...sample,
        status: "failed",
        error: "SMTP timeout",
        providerMessageId: undefined,
      };
      const created = DeliveryAttemptDTOFns.fromPartial(failed);
      const json = DeliveryAttemptDTOFns.toJSON(created);
      const restored = DeliveryAttemptDTOFns.fromJSON(json);

      expect(restored.status).toBe("failed");
      expect(restored.error).toBe("SMTP timeout");
      expect(restored.providerMessageId).toBeUndefined();
    });
  });
});
