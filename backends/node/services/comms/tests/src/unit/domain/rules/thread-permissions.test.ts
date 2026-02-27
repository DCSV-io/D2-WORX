import { describe, it, expect } from "vitest";
import {
  canPostMessage,
  canEditMessage,
  canDeleteMessage,
  canManageParticipants,
  canManageThread,
  canAddReaction,
  createThreadParticipant,
  createMessage,
  markParticipantLeft,
} from "@d2/comms-domain";
import type { ThreadParticipant, Message } from "@d2/comms-domain";

function makeParticipant(
  role: "observer" | "participant" | "moderator" | "creator",
  userId = "user-1",
): ThreadParticipant {
  return createThreadParticipant({ threadId: "thread-1", userId, role });
}

function makeMessage(senderUserId = "user-1"): Message {
  return createMessage({
    content: "test",
    plainTextContent: "test",
    senderUserId,
    threadId: "thread-1",
  });
}

describe("Thread Permissions", () => {
  describe("canPostMessage", () => {
    it("should allow participant to post", () => {
      expect(canPostMessage(makeParticipant("participant"))).toBe(true);
    });

    it("should allow moderator to post", () => {
      expect(canPostMessage(makeParticipant("moderator"))).toBe(true);
    });

    it("should allow creator to post", () => {
      expect(canPostMessage(makeParticipant("creator"))).toBe(true);
    });

    it("should NOT allow observer to post", () => {
      expect(canPostMessage(makeParticipant("observer"))).toBe(false);
    });

    it("should NOT allow left participant to post", () => {
      const p = markParticipantLeft(makeParticipant("participant"));
      expect(canPostMessage(p)).toBe(false);
    });
  });

  describe("canEditMessage", () => {
    it("should allow participant to edit own message", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = makeMessage("user-1");
      expect(canEditMessage(p, msg)).toBe(true);
    });

    it("should NOT allow participant to edit others message", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = makeMessage("user-2");
      expect(canEditMessage(p, msg)).toBe(false);
    });

    it("should allow moderator to edit others message", () => {
      const p = makeParticipant("moderator", "user-1");
      const msg = makeMessage("user-2");
      expect(canEditMessage(p, msg)).toBe(true);
    });

    it("should allow creator to edit others message", () => {
      const p = makeParticipant("creator", "user-1");
      const msg = makeMessage("user-2");
      expect(canEditMessage(p, msg)).toBe(true);
    });

    it("should NOT allow observer to edit own message", () => {
      const p = makeParticipant("observer", "user-1");
      const msg = makeMessage("user-1");
      expect(canEditMessage(p, msg)).toBe(false);
    });

    it("should NOT allow left participant to edit", () => {
      const p = markParticipantLeft(makeParticipant("moderator", "user-1"));
      const msg = makeMessage("user-2");
      expect(canEditMessage(p, msg)).toBe(false);
    });

    it("should recognize contact-based ownership via contactId", () => {
      const p = createThreadParticipant({
        threadId: "thread-1",
        contactId: "contact-1",
        role: "participant",
      });
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderContactId: "contact-1",
        threadId: "thread-1",
      });
      expect(canEditMessage(p, msg)).toBe(true);
    });

    it("should NOT allow contact-participant to edit another contact's message", () => {
      const p = createThreadParticipant({
        threadId: "thread-1",
        contactId: "contact-1",
        role: "participant",
      });
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderContactId: "contact-2",
        threadId: "thread-1",
      });
      expect(canEditMessage(p, msg)).toBe(false);
    });

    it("should NOT consider system messages as owned by any participant", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = createMessage({
        content: "System notification",
        plainTextContent: "System notification",
        senderService: "billing",
        threadId: "thread-1",
      });
      // senderUserId is null, so no userId match → not own message
      expect(canEditMessage(p, msg)).toBe(false);
    });

    it("should allow moderator to edit system messages", () => {
      const p = makeParticipant("moderator", "user-1");
      const msg = createMessage({
        content: "System notification",
        plainTextContent: "System notification",
        senderService: "billing",
        threadId: "thread-1",
      });
      expect(canEditMessage(p, msg)).toBe(true);
    });
  });

  describe("canDeleteMessage", () => {
    it("should allow participant to delete own message", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = makeMessage("user-1");
      expect(canDeleteMessage(p, msg)).toBe(true);
    });

    it("should NOT allow participant to delete others message", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = makeMessage("user-2");
      expect(canDeleteMessage(p, msg)).toBe(false);
    });

    it("should allow moderator to delete others message", () => {
      const p = makeParticipant("moderator", "user-1");
      const msg = makeMessage("user-2");
      expect(canDeleteMessage(p, msg)).toBe(true);
    });

    it("should allow contact-participant to delete own message", () => {
      const p = createThreadParticipant({
        threadId: "thread-1",
        contactId: "contact-1",
        role: "participant",
      });
      const msg = createMessage({
        content: "test",
        plainTextContent: "test",
        senderContactId: "contact-1",
        threadId: "thread-1",
      });
      expect(canDeleteMessage(p, msg)).toBe(true);
    });

    it("should NOT allow participant to delete system messages", () => {
      const p = makeParticipant("participant", "user-1");
      const msg = createMessage({
        content: "System message",
        plainTextContent: "System message",
        senderService: "auth",
        threadId: "thread-1",
      });
      expect(canDeleteMessage(p, msg)).toBe(false);
    });

    it("should NOT allow left participant to delete own message", () => {
      const p = markParticipantLeft(makeParticipant("participant", "user-1"));
      const msg = makeMessage("user-1");
      expect(canDeleteMessage(p, msg)).toBe(false);
    });
  });

  describe("canManageParticipants", () => {
    it("should allow moderator", () => {
      expect(canManageParticipants(makeParticipant("moderator"))).toBe(true);
    });

    it("should allow creator", () => {
      expect(canManageParticipants(makeParticipant("creator"))).toBe(true);
    });

    it("should NOT allow participant", () => {
      expect(canManageParticipants(makeParticipant("participant"))).toBe(false);
    });

    it("should NOT allow observer", () => {
      expect(canManageParticipants(makeParticipant("observer"))).toBe(false);
    });

    it("should NOT allow left moderator", () => {
      const p = markParticipantLeft(makeParticipant("moderator"));
      expect(canManageParticipants(p)).toBe(false);
    });
  });

  describe("canManageThread", () => {
    it("should allow moderator", () => {
      expect(canManageThread(makeParticipant("moderator"))).toBe(true);
    });

    it("should allow creator", () => {
      expect(canManageThread(makeParticipant("creator"))).toBe(true);
    });

    it("should NOT allow participant", () => {
      expect(canManageThread(makeParticipant("participant"))).toBe(false);
    });

    it("should NOT allow observer", () => {
      expect(canManageThread(makeParticipant("observer"))).toBe(false);
    });
  });

  describe("canAddReaction", () => {
    it("should allow participant", () => {
      expect(canAddReaction(makeParticipant("participant"))).toBe(true);
    });

    it("should allow moderator", () => {
      expect(canAddReaction(makeParticipant("moderator"))).toBe(true);
    });

    it("should NOT allow observer", () => {
      expect(canAddReaction(makeParticipant("observer"))).toBe(false);
    });

    it("should NOT allow left participant", () => {
      const p = markParticipantLeft(makeParticipant("participant"));
      expect(canAddReaction(p)).toBe(false);
    });
  });
});
