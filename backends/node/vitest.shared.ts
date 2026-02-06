import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    include: ["**/*.test.ts", "**/*.spec.ts"],
  },
});
