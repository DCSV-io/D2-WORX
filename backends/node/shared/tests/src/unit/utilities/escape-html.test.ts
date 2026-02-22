import { describe, it, expect } from "vitest";
import { escapeHtml } from "@d2/utilities";

describe("escapeHtml", () => {
  it("should escape < and > characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;",
    );
  });

  it("should escape & character", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should escape \" and ' characters", () => {
    expect(escapeHtml(`She said "hello" and it's fine`)).toBe(
      "She said &quot;hello&quot; and it&#x27;s fine",
    );
  });

  it("should leave clean strings untouched", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
