import { describe, it, expect } from "vitest";
import { createMessageReceipt, CommsValidationError } from "@d2/comms-domain";

describe("MessageReceipt", () => {
  const validInput = {
    messageId: "msg-123",
    userId: "user-456",
  };

  describe("createMessageReceipt", () => {
    it("should create a receipt with valid input", () => {
      const receipt = createMessageReceipt(validInput);
      expect(receipt.messageId).toBe("msg-123");
      expect(receipt.userId).toBe("user-456");
      expect(receipt.readAt).toBeInstanceOf(Date);
      expect(receipt.id).toHaveLength(36);
    });

    it("should generate unique IDs", () => {
      const r1 = createMessageReceipt(validInput);
      const r2 = createMessageReceipt(validInput);
      expect(r1.id).not.toBe(r2.id);
    });

    it("should accept a pre-generated ID", () => {
      const receipt = createMessageReceipt({ ...validInput, id: "custom-id" });
      expect(receipt.id).toBe("custom-id");
    });

    it("should throw when messageId is empty", () => {
      expect(() => createMessageReceipt({ ...validInput, messageId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when userId is empty", () => {
      expect(() => createMessageReceipt({ ...validInput, userId: "" })).toThrow(
        CommsValidationError,
      );
    });
  });
});
