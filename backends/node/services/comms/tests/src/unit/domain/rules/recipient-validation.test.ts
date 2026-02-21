import { describe, it, expect } from "vitest";
import { hasValidRecipient, describeRecipient, createDeliveryRequest } from "@d2/comms-domain";

describe("Recipient Validation", () => {
  describe("hasValidRecipient", () => {
    it("should return true when recipientUserId is set", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: "user-1",
      });
      expect(hasValidRecipient(req)).toBe(true);
    });

    it("should return true when recipientContactId is set", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientContactId: "contact-1",
      });
      expect(hasValidRecipient(req)).toBe(true);
    });

    it("should return true when both are set", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: "user-1",
        recipientContactId: "contact-1",
      });
      expect(hasValidRecipient(req)).toBe(true);
    });
  });

  describe("describeRecipient", () => {
    it("should describe user recipient", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: "user-123",
      });
      expect(describeRecipient(req)).toBe("user:user-123");
    });

    it("should describe contact recipient", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientContactId: "contact-456",
      });
      expect(describeRecipient(req)).toBe("contact:contact-456");
    });

    it("should prefer user when both are set", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: "user-1",
        recipientContactId: "contact-1",
      });
      expect(describeRecipient(req)).toBe("user:user-1");
    });

    it("should return 'none' when both recipients are null", () => {
      // Construct a request-like object with nulls (bypassing factory validation)
      const fakeReq = {
        id: "req-1",
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: null,
        recipientContactId: null,
        channels: null,
        templateName: null,
        callbackTopic: null,
        createdAt: new Date(),
        processedAt: null,
      } as const;
      expect(describeRecipient(fakeReq)).toBe("none");
      expect(hasValidRecipient(fakeReq)).toBe(false);
    });
  });
});
