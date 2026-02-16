import { describe, it, expect } from "vitest";
import { ensureUsername } from "@d2/auth-infra";

describe("ensureUsername", () => {
  it("should auto-generate username when none is provided", () => {
    const userData = { email: "test@example.com", name: "Test User" };
    const result = ensureUsername(userData);

    expect(result["username"]).toBeDefined();
    expect(typeof result["username"]).toBe("string");
    expect((result["username"] as string).length).toBeGreaterThan(0);

    expect(result["displayUsername"]).toBeDefined();
    expect(typeof result["displayUsername"]).toBe("string");
    expect((result["displayUsername"] as string).length).toBeGreaterThan(0);
  });

  it("should generate lowercase username", () => {
    const result = ensureUsername({ email: "test@example.com", name: "Test" });
    const username = result["username"] as string;
    expect(username).toBe(username.toLowerCase());
  });

  it("should generate PascalCase displayUsername", () => {
    const result = ensureUsername({ email: "test@example.com", name: "Test" });
    const displayUsername = result["displayUsername"] as string;
    expect(displayUsername[0]).toBe(displayUsername[0].toUpperCase());
  });

  it("should preserve existing username", () => {
    const userData = {
      email: "test@example.com",
      name: "Test",
      username: "customuser",
      displayUsername: "CustomUser",
    };
    const result = ensureUsername(userData);

    expect(result["username"]).toBe("customuser");
    expect(result["displayUsername"]).toBe("CustomUser");
  });

  it("should default displayUsername to username when only username is provided", () => {
    const userData = {
      email: "test@example.com",
      name: "Test",
      username: "myhandle",
    };
    const result = ensureUsername(userData);

    expect(result["username"]).toBe("myhandle");
    expect(result["displayUsername"]).toBe("myhandle");
  });

  it("should preserve all other fields", () => {
    const userData = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      image: "https://example.com/photo.jpg",
    };
    const result = ensureUsername(userData);

    expect(result["id"]).toBe("user-123");
    expect(result["email"]).toBe("test@example.com");
    expect(result["name"]).toBe("Test User");
    expect(result["image"]).toBe("https://example.com/photo.jpg");
  });

  it("should not overwrite existing displayUsername (snake_case)", () => {
    const userData = {
      email: "test@example.com",
      name: "Test",
      username: "myhandle",
      display_username: "MyHandle",
    };
    const result = ensureUsername(userData);

    expect(result["username"]).toBe("myhandle");
    // Should keep existing display_username, not overwrite
    expect(result["display_username"]).toBe("MyHandle");
  });
});
