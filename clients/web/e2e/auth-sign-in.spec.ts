import { expect, test } from "@playwright/test";

test.describe("sign-in page (/sign-in)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
  });

  // --- Rendering ---

  test("page title and heading visible", async ({ page }) => {
    await expect(page).toHaveTitle("Sign In — DCSV WORX");
    await expect(page.getByText("Sign In")).toBeVisible();
    await expect(page.getByText("Enter your credentials to access your account.")).toBeVisible();
  });

  test("email and password fields visible", async ({ page }) => {
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("has sign-up link", async ({ page }) => {
    const signUpLink = page.getByRole("link", { name: "Sign up" });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute("href", "/sign-up");
  });

  // --- Client-side validation ---

  test("blur empty email shows error", async ({ page }) => {
    const emailInput = page.getByLabel("Email", { exact: true });
    await emailInput.focus();
    await emailInput.blur();
    await expect(page.getByText("Required").first()).toBeVisible({ timeout: 2000 });
  });

  test("blur empty password shows error", async ({ page }) => {
    const passwordInput = page.getByLabel("Password");
    await passwordInput.focus();
    await passwordInput.blur();
    await expect(page.getByText("Password is required")).toBeVisible({ timeout: 2000 });
  });

  test("invalid email format shows error on blur", async ({ page }) => {
    const emailInput = page.getByLabel("Email", { exact: true });
    await emailInput.fill("not-an-email");
    await emailInput.blur();
    await expect(page.getByText("Invalid email address")).toBeVisible({ timeout: 2000 });
  });

  test("empty form submit shows validation errors", async ({ page }) => {
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Required").first()).toBeVisible({ timeout: 5000 });
  });

  // --- Error clearing ---

  test("fixing invalid email clears error on blur", async ({ page }) => {
    const emailInput = page.getByLabel("Email", { exact: true });
    await emailInput.fill("not-valid");
    await emailInput.blur();
    await expect(page.getByText("Invalid email address")).toBeVisible({ timeout: 2000 });

    await emailInput.fill("valid@example.com");
    await emailInput.blur();
    await expect(page.getByText("Invalid email address")).not.toBeVisible({ timeout: 2000 });
  });

  test("fixing empty password clears error on blur", async ({ page }) => {
    const passwordInput = page.getByLabel("Password");
    await passwordInput.focus();
    await passwordInput.blur();
    await expect(page.getByText("Password is required")).toBeVisible({ timeout: 2000 });

    await passwordInput.fill("anything");
    await passwordInput.blur();
    await expect(page.getByText("Password is required")).not.toBeVisible({ timeout: 2000 });
  });

  // --- Password field has no type constraint ---

  test("password field does not show complexity errors", async ({ page }) => {
    const passwordInput = page.getByLabel("Password");
    await passwordInput.fill("123456789012");
    await passwordInput.blur();
    // Sign-in has no numeric-only rule — should NOT show password complexity error
    await expect(page.getByText("Password cannot be only numbers")).not.toBeVisible({
      timeout: 1000,
    });
  });
});
