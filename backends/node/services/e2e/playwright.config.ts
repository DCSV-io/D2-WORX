import { defineConfig } from "@playwright/test";

/**
 * Tier 2: True browser E2E tests with full infrastructure.
 *
 * Uses globalSetup/globalTeardown to start containers + services + SvelteKit
 * once for all browser tests. Each test gets its own browser context via
 * Playwright Test's built-in fixtures.
 */
export default defineConfig({
  testDir: "src/browser",
  globalSetup: "./src/browser/global-setup.ts",
  globalTeardown: "./src/browser/global-teardown.ts",
  timeout: 60_000,
  retries: 1,
  use: {
    // Base URL is set dynamically via SVELTEKIT_BASE_URL env var in global-setup
    baseURL: process.env.SVELTEKIT_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  reporter: [["html", { open: "never" }]],
});
