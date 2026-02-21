import { describe, it, expect } from "vitest";
import {
  createDeliveryRequest,
  markDeliveryRequestProcessed,
  CommsValidationError,
} from "@d2/comms-domain";

describe("DeliveryRequest", () => {
  const validInput = {
    messageId: "msg-123",
    correlationId: "corr-456",
    recipientUserId: "user-789",
  };

  describe("createDeliveryRequest", () => {
    it("should create a delivery request with valid input", () => {
      const req = createDeliveryRequest(validInput);
      expect(req.messageId).toBe("msg-123");
      expect(req.correlationId).toBe("corr-456");
      expect(req.recipientUserId).toBe("user-789");
      expect(req.id).toHaveLength(36);
      expect(req.createdAt).toBeInstanceOf(Date);
      expect(req.processedAt).toBeNull();
    });

    it("should generate unique IDs", () => {
      const req1 = createDeliveryRequest(validInput);
      const req2 = createDeliveryRequest(validInput);
      expect(req1.id).not.toBe(req2.id);
    });

    it("should accept a pre-generated ID", () => {
      const req = createDeliveryRequest({ ...validInput, id: "custom-id" });
      expect(req.id).toBe("custom-id");
    });

    it("should default nullable fields to null", () => {
      const req = createDeliveryRequest(validInput);
      expect(req.recipientContactId).toBeNull();
      expect(req.channels).toBeNull();
      expect(req.templateName).toBeNull();
      expect(req.callbackTopic).toBeNull();
    });

    it("should accept recipientContactId", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientContactId: "contact-1",
      });
      expect(req.recipientContactId).toBe("contact-1");
      expect(req.recipientUserId).toBeNull();
    });

    it("should accept explicit channels", () => {
      const req = createDeliveryRequest({ ...validInput, channels: ["email"] });
      expect(req.channels).toEqual(["email"]);
    });

    it("should accept templateName", () => {
      const req = createDeliveryRequest({ ...validInput, templateName: "transactional" });
      expect(req.templateName).toBe("transactional");
    });

    it("should accept callbackTopic", () => {
      const req = createDeliveryRequest({ ...validInput, callbackTopic: "signup.complete" });
      expect(req.callbackTopic).toBe("signup.complete");
    });

    // --- Validation errors ---

    it("should throw when messageId is empty", () => {
      expect(() => createDeliveryRequest({ ...validInput, messageId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when correlationId is empty", () => {
      expect(() => createDeliveryRequest({ ...validInput, correlationId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when no recipient is provided", () => {
      expect(() =>
        createDeliveryRequest({
          messageId: "msg-1",
          correlationId: "corr-1",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when channels contains invalid value", () => {
      expect(() =>
        createDeliveryRequest({ ...validInput, channels: ["email", "push" as never] }),
      ).toThrow(CommsValidationError);
    });

    it("should accept both recipientUserId and recipientContactId", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: "user-1",
        recipientContactId: "contact-1",
      });
      expect(req.recipientUserId).toBe("user-1");
      expect(req.recipientContactId).toBe("contact-1");
    });

    it("should accept empty channels array", () => {
      const req = createDeliveryRequest({ ...validInput, channels: [] });
      expect(req.channels).toEqual([]);
    });

    it("should treat null recipientUserId as no user recipient", () => {
      const req = createDeliveryRequest({
        messageId: "msg-1",
        correlationId: "corr-1",
        recipientUserId: null,
        recipientContactId: "contact-1",
      });
      expect(req.recipientUserId).toBeNull();
      expect(req.recipientContactId).toBe("contact-1");
    });
  });

  describe("markDeliveryRequestProcessed", () => {
    it("should set processedAt", () => {
      const req = createDeliveryRequest(validInput);
      const processed = markDeliveryRequestProcessed(req);
      expect(processed.processedAt).toBeInstanceOf(Date);
      expect(processed.processedAt).not.toBeNull();
    });

    it("should preserve other fields", () => {
      const req = createDeliveryRequest(validInput);
      const processed = markDeliveryRequestProcessed(req);
      expect(processed.id).toBe(req.id);
      expect(processed.messageId).toBe(req.messageId);
      expect(processed.correlationId).toBe(req.correlationId);
      expect(processed.createdAt).toBe(req.createdAt);
    });
  });
});
