import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GeoRefDataUpdatedEventFns,
  SendVerificationEmailEventFns,
  SendPasswordResetEventFns,
  SendInvitationEmailEventFns,
} from "@d2/protos";

/**
 * Contract tests that validate JSON fixtures can be deserialized into proto types
 * and survive a round-trip through toJSON / fromJSON.
 * Both .NET and Node.js run these tests against the same fixtures to guarantee
 * cross-language compatibility.
 */

const fixturesDir = resolve(__dirname, "../../../../../../../contracts/fixtures/events/v1");

function readFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(fixturesDir, filename), "utf-8"));
}

describe("Event contract tests", () => {
  describe("GeoRefDataUpdatedEvent", () => {
    it("should deserialize the fixture correctly", () => {
      const json = readFixture("geo-ref-data-updated.json");
      const parsed = GeoRefDataUpdatedEventFns.fromJSON(json);

      expect(parsed.version).toBe("3.0.0");
    });

    it("should survive a JSON round-trip", () => {
      const json = readFixture("geo-ref-data-updated.json");
      const parsed = GeoRefDataUpdatedEventFns.fromJSON(json);

      const serialized = GeoRefDataUpdatedEventFns.toJSON(parsed);
      const reparsed = GeoRefDataUpdatedEventFns.fromJSON(serialized);

      expect(reparsed.version).toBe(parsed.version);
    });
  });

  describe("SendVerificationEmailEvent", () => {
    it("should deserialize the fixture correctly", () => {
      const json = readFixture("send-verification-email.json");
      const parsed = SendVerificationEmailEventFns.fromJSON(json);

      expect(parsed.userId).toBe("019500aa-bbcc-7def-8901-234567890abc");
      expect(parsed.email).toBe("test@example.com");
      expect(parsed.name).toBe("Test User");
      expect(parsed.verificationUrl).toBe("https://app.example.com/verify?token=abc123");
      expect(parsed.token).toBe("abc123");
    });

    it("should survive a JSON round-trip", () => {
      const json = readFixture("send-verification-email.json");
      const parsed = SendVerificationEmailEventFns.fromJSON(json);

      const serialized = SendVerificationEmailEventFns.toJSON(parsed);
      const reparsed = SendVerificationEmailEventFns.fromJSON(serialized);

      expect(reparsed.userId).toBe(parsed.userId);
      expect(reparsed.email).toBe(parsed.email);
      expect(reparsed.name).toBe(parsed.name);
      expect(reparsed.verificationUrl).toBe(parsed.verificationUrl);
      expect(reparsed.token).toBe(parsed.token);
    });
  });

  describe("SendPasswordResetEvent", () => {
    it("should deserialize the fixture correctly", () => {
      const json = readFixture("send-password-reset.json");
      const parsed = SendPasswordResetEventFns.fromJSON(json);

      expect(parsed.userId).toBe("019500aa-bbcc-7def-8901-234567890abc");
      expect(parsed.email).toBe("test@example.com");
      expect(parsed.name).toBe("Test User");
      expect(parsed.resetUrl).toBe("https://app.example.com/reset?token=def456");
      expect(parsed.token).toBe("def456");
    });

    it("should survive a JSON round-trip", () => {
      const json = readFixture("send-password-reset.json");
      const parsed = SendPasswordResetEventFns.fromJSON(json);

      const serialized = SendPasswordResetEventFns.toJSON(parsed);
      const reparsed = SendPasswordResetEventFns.fromJSON(serialized);

      expect(reparsed.userId).toBe(parsed.userId);
      expect(reparsed.email).toBe(parsed.email);
      expect(reparsed.name).toBe(parsed.name);
      expect(reparsed.resetUrl).toBe(parsed.resetUrl);
      expect(reparsed.token).toBe(parsed.token);
    });
  });

  describe("SendInvitationEmailEvent", () => {
    it("should deserialize the fixture correctly", () => {
      const json = readFixture("send-invitation-email.json");
      const parsed = SendInvitationEmailEventFns.fromJSON(json);

      expect(parsed.invitationId).toBe("019500bb-ccdd-7eef-0011-223344556677");
      expect(parsed.inviteeEmail).toBe("invitee@example.com");
      expect(parsed.organizationId).toBe("019500cc-ddee-7ff0-1122-334455667788");
      expect(parsed.organizationName).toBe("Acme Corp");
      expect(parsed.role).toBe("member");
      expect(parsed.inviterName).toBe("Admin User");
      expect(parsed.inviterEmail).toBe("admin@example.com");
      expect(parsed.invitationUrl).toBe("https://app.example.com/invite/accept?token=ghi789");
    });

    it("should survive a JSON round-trip", () => {
      const json = readFixture("send-invitation-email.json");
      const parsed = SendInvitationEmailEventFns.fromJSON(json);

      const serialized = SendInvitationEmailEventFns.toJSON(parsed);
      const reparsed = SendInvitationEmailEventFns.fromJSON(serialized);

      expect(reparsed.invitationId).toBe(parsed.invitationId);
      expect(reparsed.inviteeEmail).toBe(parsed.inviteeEmail);
      expect(reparsed.organizationId).toBe(parsed.organizationId);
      expect(reparsed.organizationName).toBe(parsed.organizationName);
      expect(reparsed.role).toBe(parsed.role);
      expect(reparsed.inviterName).toBe(parsed.inviterName);
      expect(reparsed.inviterEmail).toBe(parsed.inviterEmail);
      expect(reparsed.invitationUrl).toBe(parsed.invitationUrl);
    });
  });
});
