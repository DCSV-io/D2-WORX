/**
 * Tier 2: Full-stack browser E2E — Sign-up flow.
 *
 * Browser → SvelteKit → Auth Service → Geo (contact creation) → Comms (verification email).
 */
import { test, expect } from "@playwright/test";

test.describe("sign-up flow (full stack)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
  });

  test("sign-up with valid credentials creates user and redirects to verify-email", async ({
    page,
  }) => {
    const uniqueEmail = `test-${Date.now()}@e2e-test.com`;

    await page.getByLabel("First Name").fill("E2E");
    await page.getByLabel("Last Name").fill("TestUser");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail);
    await page.getByLabel("Confirm Email").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill("SecurePass12345");
    await page.getByLabel("Confirm Password").fill("SecurePass12345");

    await page.getByRole("button", { name: "Sign Up" }).click();

    // Should redirect to verify-email page after successful sign-up
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
    await expect(page.getByText("Check Your Email")).toBeVisible();
  });

  test("sign-up with duplicate email shows error", async ({ page }) => {
    const sharedEmail = `dup-${Date.now()}@e2e-test.com`;

    // First sign-up should succeed
    await page.getByLabel("First Name").fill("First");
    await page.getByLabel("Last Name").fill("User");
    await page.getByLabel("Email", { exact: true }).fill(sharedEmail);
    await page.getByLabel("Confirm Email").fill(sharedEmail);
    await page.getByLabel("Password", { exact: true }).fill("SecurePass12345");
    await page.getByLabel("Confirm Password").fill("SecurePass12345");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

    // Navigate back to sign-up and try same email
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("First Name").fill("Second");
    await page.getByLabel("Last Name").fill("User");
    await page.getByLabel("Email", { exact: true }).fill(sharedEmail);
    await page.getByLabel("Confirm Email").fill(sharedEmail);
    await page.getByLabel("Password", { exact: true }).fill("SecurePass12345");
    await page.getByLabel("Confirm Password").fill("SecurePass12345");
    await page.getByRole("button", { name: "Sign Up" }).click();

    // Should show error (user already exists)
    await expect(page.getByText(/already|exists|taken/i)).toBeVisible({ timeout: 10_000 });
  });
});
