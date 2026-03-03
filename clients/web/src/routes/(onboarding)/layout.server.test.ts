import { describe, it, expect } from "vitest";
import { load } from "./+layout.server";

describe("(onboarding) +layout.server.ts", () => {
  it("should return empty object (stub for Step 5 auth guard)", async () => {
    const result = await load({
      parent: async () => ({ session: null, user: null }),
    } as any);

    expect(result).toEqual({});
  });
});
