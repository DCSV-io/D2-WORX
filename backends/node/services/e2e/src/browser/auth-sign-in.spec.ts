/**
 * Tier 2: Full-stack browser E2E — Sign-in flow.
 *
 * Browser → SvelteKit → Auth Service → session created → redirect.
 *
 * Requires a user to exist first (created via the Auth API directly, not via browser).
 */
import { test, expect } from "@playwright/test";
import { verifyUserEmail } from "./helpers.js";

test.describe("sign-in flow (full stack)", () => {
  const TEST_EMAIL = `signin-${Date.now()}@e2e-test.com`;
  const TEST_PASSWORD = "SecurePass12345";

  test.beforeAll(async ({ request }) => {
    // Create a test user directly via the Auth API
    // The auth proxy at /api/auth/* routes to the real Auth service
    const baseUrl = process.env.AUTH_BASE_URL;
    if (!baseUrl) throw new Error("AUTH_BASE_URL not set — global-setup may have failed");

    await request.post(`${baseUrl}/api/auth/sign-up/email`, {
      data: {
        name: "Sign In Test",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    // Mark email as verified so sign-in succeeds (BetterAuth requires verification)
    await verifyUserEmail(TEST_EMAIL);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
  });

  test("sign-in with valid credentials redirects to authenticated area", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD);

    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect away from sign-in page (to dashboard, onboarding, or verify-email)
    await expect(page).not.toHaveURL(/\/sign-in$/, { timeout: 15_000 });
  });

  test("sign-in with wrong password shows error", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill("WrongPassword123");

    await page.getByRole("button", { name: "Sign In" }).click();

    // Should show credential error
    await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 10_000 });
    // Should stay on sign-in page
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-in with non-existent email shows error", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("nonexistent@e2e-test.com");
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD);

    await page.getByRole("button", { name: "Sign In" }).click();

    // Should show credential error (don't reveal whether email exists)
    await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible({ timeout: 10_000 });
  });
});
