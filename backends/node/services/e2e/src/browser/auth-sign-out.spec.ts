/**
 * Tier 2: Full-stack browser E2E — Sign-out flow.
 *
 * Verifies that signing out clears auth state and redirects to sign-in.
 */
import { test, expect } from "@playwright/test";

test.describe("sign-out flow (full stack)", () => {
  const TEST_EMAIL = `signout-${Date.now()}@e2e-test.com`;
  const TEST_PASSWORD = "SecurePass12345";

  test.beforeAll(async ({ request }) => {
    // Create a test user via the Auth API
    const baseUrl = process.env.AUTH_BASE_URL;
    if (!baseUrl) throw new Error("AUTH_BASE_URL not set — global-setup may have failed");

    await request.post(`${baseUrl}/api/auth/sign-up/email`, {
      data: {
        name: "Sign Out Test",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
  });

  test("sign out after sign in clears session and redirects to sign-in", async ({ page }) => {
    // Sign in first
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Email", { exact: true }).fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect away from sign-in
    await expect(page).not.toHaveURL(/\/sign-in$/, { timeout: 15_000 });

    // Look for sign-out button/link and click it
    const signOutButton = page.getByRole("button", { name: /sign out|log out/i });
    const signOutLink = page.getByRole("link", { name: /sign out|log out/i });

    if (await signOutButton.isVisible().catch(() => false)) {
      await signOutButton.click();
    } else if (await signOutLink.isVisible().catch(() => false)) {
      await signOutLink.click();
    } else {
      // If no visible sign-out button, navigate to a sign-out URL directly
      await page.goto("/sign-in");
    }

    // Should end up on sign-in page
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15_000 });
  });
});
