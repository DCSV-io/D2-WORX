import { describe, it, expect } from "vitest";
import {
  generateUsername,
  USERNAME_RULES,
  USERNAME_ADJECTIVES,
  USERNAME_NOUNS,
} from "@d2/auth-domain";

describe("USERNAME_RULES", () => {
  it("should have correct constants", () => {
    expect(USERNAME_RULES.MIN_SUFFIX).toBe(1);
    expect(USERNAME_RULES.MAX_SUFFIX).toBe(999);
    expect(USERNAME_RULES.MAX_WORD_LENGTH).toBe(12);
    expect(USERNAME_RULES.ADJECTIVE_COUNT).toBe(4096);
    expect(USERNAME_RULES.NOUN_COUNT).toBe(4096);
  });
});

describe("USERNAME_ADJECTIVES", () => {
  it("should have exactly 4096 entries", () => {
    expect(USERNAME_ADJECTIVES).toHaveLength(4096);
  });

  it("should have no duplicates", () => {
    const unique = new Set(USERNAME_ADJECTIVES.map((w) => w.toLowerCase()));
    expect(unique.size).toBe(USERNAME_ADJECTIVES.length);
  });

  it("should be PascalCase (first letter uppercase, rest lowercase)", () => {
    for (const word of USERNAME_ADJECTIVES) {
      expect(word[0]).toBe(word[0].toUpperCase());
      expect(word.slice(1)).toBe(word.slice(1).toLowerCase());
    }
  });

  it("should have max 12 characters per word", () => {
    for (const word of USERNAME_ADJECTIVES) {
      expect(word.length).toBeLessThanOrEqual(12);
    }
  });

  it("should only contain alphabetic characters", () => {
    for (const word of USERNAME_ADJECTIVES) {
      expect(word).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe("USERNAME_NOUNS", () => {
  it("should have exactly 4096 entries", () => {
    expect(USERNAME_NOUNS).toHaveLength(4096);
  });

  it("should have no duplicates", () => {
    const unique = new Set(USERNAME_NOUNS.map((w) => w.toLowerCase()));
    expect(unique.size).toBe(USERNAME_NOUNS.length);
  });

  it("should be PascalCase (first letter uppercase, rest lowercase)", () => {
    for (const word of USERNAME_NOUNS) {
      expect(word[0]).toBe(word[0].toUpperCase());
      expect(word.slice(1)).toBe(word.slice(1).toLowerCase());
    }
  });

  it("should have max 12 characters per word", () => {
    for (const word of USERNAME_NOUNS) {
      expect(word.length).toBeLessThanOrEqual(12);
    }
  });

  it("should only contain alphabetic characters", () => {
    for (const word of USERNAME_NOUNS) {
      expect(word).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe("generateUsername", () => {
  it("should return username and displayUsername", () => {
    const result = generateUsername();
    expect(result).toHaveProperty("username");
    expect(result).toHaveProperty("displayUsername");
  });

  it("should return lowercase username", () => {
    const { username } = generateUsername();
    expect(username).toBe(username.toLowerCase());
  });

  it("should return PascalCase displayUsername", () => {
    const { displayUsername } = generateUsername();
    // First char should be uppercase
    expect(displayUsername[0]).toBe(displayUsername[0].toUpperCase());
  });

  it("should match format AdjectiveNoun### (lowercase)", () => {
    const { username } = generateUsername();
    // lowercase letters followed by 1-3 digits
    expect(username).toMatch(/^[a-z]+\d{1,3}$/);
  });

  it("should have suffix in range 1-999", () => {
    // Generate several usernames and check suffix range
    for (let i = 0; i < 50; i++) {
      const { username } = generateUsername();
      const suffixMatch = username.match(/(\d+)$/);
      expect(suffixMatch).not.toBeNull();
      const suffix = parseInt(suffixMatch![1], 10);
      expect(suffix).toBeGreaterThanOrEqual(USERNAME_RULES.MIN_SUFFIX);
      expect(suffix).toBeLessThanOrEqual(USERNAME_RULES.MAX_SUFFIX);
    }
  });

  it("should generate different usernames (not always the same)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generateUsername().username);
    }
    // With ~16.76B combinations, 20 random picks should all be unique
    expect(results.size).toBe(20);
  });

  it("should have username equal to displayUsername lowercased", () => {
    for (let i = 0; i < 20; i++) {
      const { username, displayUsername } = generateUsername();
      expect(username).toBe(displayUsername.toLowerCase());
    }
  });

  it("should produce usernames under 30 characters", () => {
    // Max: 12 (adj) + 12 (noun) + 3 (suffix) = 27
    for (let i = 0; i < 100; i++) {
      const { username } = generateUsername();
      expect(username.length).toBeLessThanOrEqual(27);
    }
  });
});
