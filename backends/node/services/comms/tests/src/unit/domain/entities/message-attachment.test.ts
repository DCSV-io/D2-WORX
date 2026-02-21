import { describe, it, expect } from "vitest";
import {
  createMessageAttachment,
  CommsValidationError,
  THREAD_CONSTRAINTS,
} from "@d2/comms-domain";

describe("MessageAttachment", () => {
  const validInput = {
    messageId: "msg-123",
    fileUrl: "https://cdn.example.com/files/doc.pdf",
    fileName: "doc.pdf",
    fileType: "application/pdf",
    fileSize: 1024 * 1024, // 1 MB
  };

  describe("createMessageAttachment", () => {
    it("should create an attachment with valid input", () => {
      const att = createMessageAttachment(validInput);
      expect(att.messageId).toBe("msg-123");
      expect(att.fileUrl).toBe("https://cdn.example.com/files/doc.pdf");
      expect(att.fileName).toBe("doc.pdf");
      expect(att.fileType).toBe("application/pdf");
      expect(att.fileSize).toBe(1024 * 1024);
      expect(att.id).toHaveLength(36);
      expect(att.createdAt).toBeInstanceOf(Date);
    });

    it("should clean and trim fileName", () => {
      const att = createMessageAttachment({ ...validInput, fileName: "  my file.pdf  " });
      expect(att.fileName).toBe("my file.pdf");
    });

    it("should throw when messageId is empty", () => {
      expect(() => createMessageAttachment({ ...validInput, messageId: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileUrl is empty", () => {
      expect(() => createMessageAttachment({ ...validInput, fileUrl: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileName is empty", () => {
      expect(() => createMessageAttachment({ ...validInput, fileName: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileType is empty", () => {
      expect(() => createMessageAttachment({ ...validInput, fileType: "" })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileSize is zero", () => {
      expect(() => createMessageAttachment({ ...validInput, fileSize: 0 })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileSize is negative", () => {
      expect(() => createMessageAttachment({ ...validInput, fileSize: -100 })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileSize exceeds 50MB", () => {
      expect(() =>
        createMessageAttachment({
          ...validInput,
          fileSize: THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES + 1,
        }),
      ).toThrow(CommsValidationError);
    });

    it("should accept fileSize at exactly 50MB", () => {
      const att = createMessageAttachment({
        ...validInput,
        fileSize: THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES,
      });
      expect(att.fileSize).toBe(THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES);
    });

    it("should throw when fileSize is NaN", () => {
      expect(() => createMessageAttachment({ ...validInput, fileSize: NaN })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileSize is Infinity", () => {
      expect(() => createMessageAttachment({ ...validInput, fileSize: Infinity })).toThrow(
        CommsValidationError,
      );
    });

    it("should throw when fileSize is -Infinity", () => {
      expect(() => createMessageAttachment({ ...validInput, fileSize: -Infinity })).toThrow(
        CommsValidationError,
      );
    });

    it("should accept fractional fileSize (bytes are exact)", () => {
      const att = createMessageAttachment({ ...validInput, fileSize: 1024.5 });
      expect(att.fileSize).toBe(1024.5);
    });

    it("should generate unique IDs", () => {
      const a1 = createMessageAttachment(validInput);
      const a2 = createMessageAttachment(validInput);
      expect(a1.id).not.toBe(a2.id);
    });

    it("should clean and trim fileType", () => {
      const att = createMessageAttachment({ ...validInput, fileType: "  image/png  " });
      expect(att.fileType).toBe("image/png");
    });
  });
});
