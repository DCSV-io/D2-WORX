/**
 * Tier 2: Full-stack browser E2E — Password reset request flow.
 *
 * Browser → SvelteKit → Auth Service → Comms (password reset email).
 *
 * Tests the request flow (entering email, seeing confirmation).
 * Does NOT test clicking the reset link from the email (would need
 * to extract the token from the stub email provider).
 */
import { test, expect } from "@playwright/test";

test.describe("password reset request (full stack)", () => {
  const TEST_EMAIL = `reset-${Date.now()}@e2e-test.com`;
  const TEST_PASSWORD = "SecurePass12345";

  test.beforeAll(async ({ request }) => {
    // Create a test user via the Auth API
    const baseUrl = process.env.AUTH_BASE_URL;
    if (!baseUrl) throw new Error("AUTH_BASE_URL not set — global-setup may have failed");

    await request.post(`${baseUrl}/api/auth/sign-up/email`, {
      data: {
        name: "Password Reset Test",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });
  });

  test("forgot password form submits and shows confirmation", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Email", { exact: true }).fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    // Should show a success/confirmation message or redirect
    // BetterAuth's forgetPassword returns success even for unknown emails (no enumeration)
    await expect(page.getByText(/sent|check your email|reset link/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("forgot password with unknown email still shows confirmation (no enumeration)", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Email", { exact: true }).fill("unknown@e2e-test.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    // Should still show confirmation (don't reveal whether email exists)
    await expect(page.getByText(/sent|check your email|reset link/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reset password page without token shows invalid link message", async ({ page }) => {
    await page.goto("/reset-password");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Invalid or Expired Link")).toBeVisible();
    await expect(page.getByRole("link", { name: "Request a new link." })).toBeVisible();
  });
});
