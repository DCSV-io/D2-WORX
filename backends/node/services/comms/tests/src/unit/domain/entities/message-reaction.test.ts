import { describe, it, expect } from "vitest";
import { createMessageReaction, CommsValidationError, THREAD_CONSTRAINTS } from "@d2/comms-domain";

describe("MessageReaction", () => {
  const validInput = {
    messageId: "msg-123",
    userId: "user-456",
    reaction: "thumbs_up",
  };

  describe("createMessageReaction", () => {
    it("should create a reaction with valid input", () => {
      const reaction = createMessageReaction(validInput);
      expect(reaction.messageId).toBe("msg-123");
      expect(reaction.userId).toBe("user-456");
      expect(reaction.reaction).toBe("thumbs_up");
      expect(reaction.id).toHaveLength(36);
      expect(reaction.createdAt).toBeInstanceOf(Date);
    });

    it("should clean and trim reaction", () => {
      const reaction = createMessageReaction({ ...validInput, reaction: "  heart  " });
      expect(reaction.reaction).toBe("heart");
    });

    it("should throw when messageId is empty", () => {
      expect(() => createMessageReaction({ ...validInput, messageId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when userId is empty", () => {
      expect(() => createMessageReaction({ ...validInput, userId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when reaction is empty", () => {
      expect(() => createMessageReaction({ ...validInput, reaction: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when reaction is whitespace only", () => {
      expect(() => createMessageReaction({ ...validInput, reaction: "   " })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when reaction exceeds max length", () => {
      const longReaction = "x".repeat(THREAD_CONSTRAINTS.MAX_REACTION_LENGTH + 1);
      expect(() => createMessageReaction({ ...validInput, reaction: longReaction })).toThrow(
        CommsValidationError,
      );
    });

    it("should accept reaction at exactly max length", () => {
      const maxReaction = "x".repeat(THREAD_CONSTRAINTS.MAX_REACTION_LENGTH);
      const reaction = createMessageReaction({ ...validInput, reaction: maxReaction });
      expect(reaction.reaction).toBe(maxReaction);
    });

    it("should accept emoji/unicode reactions", () => {
      const reaction = createMessageReaction({ ...validInput, reaction: "thumbs_up" });
      expect(reaction.reaction).toBe("thumbs_up");
    });

    it("should generate unique IDs", () => {
      const r1 = createMessageReaction(validInput);
      const r2 = createMessageReaction(validInput);
      expect(r1.id).not.toBe(r2.id);
    });
  });
});
