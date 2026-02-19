import { describe, it, expect } from "vitest";
import { hasValidSender, createMessage } from "@d2/comms-domain";

describe("Message Validation", () => {
  describe("hasValidSender", () => {
    it("should return true when senderUserId is set", () => {
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderUserId: "user-1",
      });
      expect(hasValidSender(msg)).toBe(true);
    });

    it("should return true when senderContactId is set", () => {
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderContactId: "contact-1",
      });
      expect(hasValidSender(msg)).toBe(true);
    });

    it("should return true when senderService is set", () => {
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderService: "auth",
      });
      expect(hasValidSender(msg)).toBe(true);
    });

    it("should return true when multiple senders are set", () => {
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderUserId: "user-1",
        senderService: "billing",
      });
      expect(hasValidSender(msg)).toBe(true);
    });

    it("should return false when all sender fields are null", () => {
      // Construct a message-like object with all null senders (bypassing factory validation)
      const fakeMsg = {
        id: "msg-1",
        threadId: null,
        parentMessageId: null,
        senderUserId: null,
        senderContactId: null,
        senderService: null,
        title: null,
        content: "test",
        plainTextContent: "test",
        contentFormat: "markdown" as const,
        sensitive: false,
        urgency: "normal" as const,
        relatedEntityId: null,
        relatedEntityType: null,
        metadata: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(hasValidSender(fakeMsg)).toBe(false);
    });

    it("should return false when sender fields are empty strings", () => {
      const fakeMsg = {
        id: "msg-1",
        threadId: null,
        parentMessageId: null,
        senderUserId: "",
        senderContactId: "",
        senderService: "",
        title: null,
        content: "test",
        plainTextContent: "test",
        contentFormat: "markdown" as const,
        sensitive: false,
        urgency: "normal" as const,
        relatedEntityId: null,
        relatedEntityType: null,
        metadata: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(hasValidSender(fakeMsg)).toBe(false);
    });
  });
});
