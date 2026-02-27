import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GeoRefDataUpdatedEventFns } from "@d2/protos";

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
});
