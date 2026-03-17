import { describe, it, expect } from "vitest";
import {
  FILES_SIZE_LIMITS,
  FILES_FIELD_LIMITS,
  VARIANT_CONFIGS,
  ALLOWED_CONTENT_TYPES,
  CONTEXT_KEY_PREFIXES,
  FILES_MESSAGING,
  FILES_PROCESSING,
  FILES_CONTEXT_KEYS,
  VARIANT_SIZES,
} from "@d2/files-domain";

describe("Files Constants", () => {
  describe("FILES_SIZE_LIMITS", () => {
    it("should have correct default max size (25 MB)", () => {
      expect(FILES_SIZE_LIMITS.DEFAULT_MAX_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });

    it("should have correct avatar max size (5 MB)", () => {
      expect(FILES_SIZE_LIMITS.AVATAR_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it("should have correct document max size (25 MB)", () => {
      expect(FILES_SIZE_LIMITS.DOCUMENT_MAX_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });

    it("should have correct attachment max size (10 MB)", () => {
      expect(FILES_SIZE_LIMITS.ATTACHMENT_MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });
  });

  describe("FILES_FIELD_LIMITS", () => {
    it("should have positive max lengths", () => {
      expect(FILES_FIELD_LIMITS.MAX_CONTEXT_KEY_LENGTH).toBeGreaterThan(0);
      expect(FILES_FIELD_LIMITS.MAX_RELATED_ENTITY_ID_LENGTH).toBeGreaterThan(0);
      expect(FILES_FIELD_LIMITS.MAX_CONTENT_TYPE_LENGTH).toBeGreaterThan(0);
      expect(FILES_FIELD_LIMITS.MAX_DISPLAY_NAME_LENGTH).toBeGreaterThan(0);
      expect(FILES_FIELD_LIMITS.MAX_VARIANT_KEY_LENGTH).toBeGreaterThan(0);
    });
  });

  describe("VARIANT_CONFIGS", () => {
    it("should have entries for all variant sizes", () => {
      for (const size of VARIANT_SIZES) {
        expect(VARIANT_CONFIGS[size]).toBeDefined();
        expect(VARIANT_CONFIGS[size]).toHaveProperty("width");
        expect(VARIANT_CONFIGS[size]).toHaveProperty("height");
      }
    });

    it("should have thumb at 64x64", () => {
      expect(VARIANT_CONFIGS.thumb).toEqual({ width: 64, height: 64 });
    });

    it("should have small at 128x128", () => {
      expect(VARIANT_CONFIGS.small).toEqual({ width: 128, height: 128 });
    });

    it("should have medium at 512x512", () => {
      expect(VARIANT_CONFIGS.medium).toEqual({ width: 512, height: 512 });
    });

    it("should have large at 1024x1024", () => {
      expect(VARIANT_CONFIGS.large).toEqual({ width: 1024, height: 1024 });
    });

    it("should have original at 0x0 (no resize)", () => {
      expect(VARIANT_CONFIGS.original).toEqual({ width: 0, height: 0 });
    });
  });

  describe("ALLOWED_CONTENT_TYPES", () => {
    it("should include jpeg, png, and webp for images", () => {
      expect(ALLOWED_CONTENT_TYPES.image).toContain("image/jpeg");
      expect(ALLOWED_CONTENT_TYPES.image).toContain("image/png");
      expect(ALLOWED_CONTENT_TYPES.image).toContain("image/webp");
    });

    it("should include HEIC/HEIF for smartphone photos", () => {
      expect(ALLOWED_CONTENT_TYPES.image).toContain("image/heic");
      expect(ALLOWED_CONTENT_TYPES.image).toContain("image/heif");
    });

    it("should include pdf for documents", () => {
      expect(ALLOWED_CONTENT_TYPES.document).toContain("application/pdf");
    });

    it("should include mp4 and 3gpp for video", () => {
      expect(ALLOWED_CONTENT_TYPES.video).toContain("video/mp4");
      expect(ALLOWED_CONTENT_TYPES.video).toContain("video/3gpp");
    });

    it("should include mpeg, aac, and m4a for audio", () => {
      expect(ALLOWED_CONTENT_TYPES.audio).toContain("audio/mpeg");
      expect(ALLOWED_CONTENT_TYPES.audio).toContain("audio/aac");
      expect(ALLOWED_CONTENT_TYPES.audio).toContain("audio/mp4");
    });
  });

  describe("CONTEXT_KEY_PREFIXES", () => {
    it("should have entries for user_, org_, and thread_", () => {
      expect(CONTEXT_KEY_PREFIXES["user_"]).toBeDefined();
      expect(CONTEXT_KEY_PREFIXES["org_"]).toBeDefined();
      expect(CONTEXT_KEY_PREFIXES["thread_"]).toBeDefined();
    });

    it("should use jwt resolution for user_ and org_", () => {
      expect(CONTEXT_KEY_PREFIXES["user_"]!.resolution).toBe("jwt");
      expect(CONTEXT_KEY_PREFIXES["org_"]!.resolution).toBe("jwt");
    });

    it("should use callback resolution for thread_", () => {
      expect(CONTEXT_KEY_PREFIXES["thread_"]!.resolution).toBe("callback");
    });

    it("should have prefix values ending with underscore", () => {
      for (const [, config] of Object.entries(CONTEXT_KEY_PREFIXES)) {
        expect(config.prefix).toMatch(/_$/);
      }
    });
  });

  describe("FILES_CONTEXT_KEYS", () => {
    it("should define well-known context keys", () => {
      expect(FILES_CONTEXT_KEYS.USER_AVATAR).toBe("user_avatar");
      expect(FILES_CONTEXT_KEYS.ORG_LOGO).toBe("org_logo");
      expect(FILES_CONTEXT_KEYS.ORG_DOCUMENT).toBe("org_document");
      expect(FILES_CONTEXT_KEYS.THREAD_ATTACHMENT).toBe("thread_attachment");
    });
  });

  describe("FILES_MESSAGING", () => {
    it("should have topic exchange type", () => {
      expect(FILES_MESSAGING.EVENTS_EXCHANGE_TYPE).toBe("topic");
    });

    it("should define exchange and queue names", () => {
      expect(FILES_MESSAGING.EVENTS_EXCHANGE).toBeTruthy();
      expect(FILES_MESSAGING.PROCESSING_QUEUE).toBeTruthy();
    });
  });

  describe("FILES_PROCESSING", () => {
    it("should have a positive stuck processing threshold", () => {
      expect(FILES_PROCESSING.STUCK_PROCESSING_THRESHOLD_MINUTES).toBeGreaterThan(0);
    });
  });
});
