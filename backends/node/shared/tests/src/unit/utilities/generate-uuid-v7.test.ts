import { describe, it, expect } from "vitest";
import { generateUuidV7, uuidTruthy, uuidFalsey, EMPTY_UUID } from "@d2/utilities";

describe("generateUuidV7", () => {
  const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("should match the UUID v7 format regex", () => {
    const uuid = generateUuidV7();
    expect(uuid).toMatch(UUID_V7_REGEX);
  });

  it("should have '7' as the version nibble at index 14", () => {
    const uuid = generateUuidV7();
    expect(uuid[14]).toBe("7");
  });

  it("should have a valid variant nibble at index 19", () => {
    const uuid = generateUuidV7();
    expect(["8", "9", "a", "b"]).toContain(uuid[19]);
  });

  it("should produce 1000 unique values", () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUuidV7());
    }
    expect(uuids.size).toBe(1000);
  });

  it("should return a string of length 36", () => {
    const uuid = generateUuidV7();
    expect(typeof uuid).toBe("string");
    expect(uuid).toHaveLength(36);
  });

  it("should return different values on multiple calls", () => {
    const a = generateUuidV7();
    const b = generateUuidV7();
    expect(a).not.toBe(b);
  });
});

describe("uuidTruthy", () => {
  it("should return false for null", () => {
    expect(uuidTruthy(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(uuidTruthy(undefined)).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(uuidTruthy("")).toBe(false);
  });

  it("should return false for EMPTY_UUID", () => {
    expect(uuidTruthy(EMPTY_UUID)).toBe(false);
  });

  it("should return true for a valid UUID", () => {
    const uuid = generateUuidV7();
    expect(uuidTruthy(uuid)).toBe(true);
  });
});

describe("uuidFalsey", () => {
  it("should return true for null", () => {
    expect(uuidFalsey(null)).toBe(true);
  });

  it("should return true for undefined", () => {
    expect(uuidFalsey(undefined)).toBe(true);
  });

  it("should return true for empty string", () => {
    expect(uuidFalsey("")).toBe(true);
  });

  it("should return true for EMPTY_UUID", () => {
    expect(uuidFalsey(EMPTY_UUID)).toBe(true);
  });

  it("should return false for a valid UUID", () => {
    const uuid = generateUuidV7();
    expect(uuidFalsey(uuid)).toBe(false);
  });
});
