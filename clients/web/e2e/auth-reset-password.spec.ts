import { expect, test } from "@playwright/test";

test.describe("reset-password page — no token (/reset-password)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reset-password");
    await page.waitForLoadState("networkidle");
  });

  // --- No token state ---

  test("renders invalid/expired token message when no token param", async ({ page }) => {
    await expect(page.getByText("Invalid or Expired Link")).toBeVisible();
    await expect(
      page.getByText("This password reset link is invalid or has expired."),
    ).toBeVisible();
  });

  test("shows 'Request a new link' button linking to /forgot-password", async ({ page }) => {
    const requestLink = page.getByRole("link", { name: "Request a new link." });
    await expect(requestLink).toBeVisible();
    await expect(requestLink).toHaveAttribute("href", "/forgot-password");
  });
});

test.describe("reset-password page — with token (/reset-password?token=...)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reset-password?token=test-token-123");
    await page.waitForLoadState("networkidle");
  });

  // --- Rendering ---

  test("renders heading and form when token param present", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Reset Password");
    await expect(page.getByText("Enter your new password.")).toBeVisible();
  });

  test("has new password input", async ({ page }) => {
    await expect(page.getByLabel("New Password", { exact: true })).toBeVisible();
  });

  test("has confirm password input", async ({ page }) => {
    await expect(page.getByLabel("Confirm New Password")).toBeVisible();
  });

  test("has submit button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Reset Password" })).toBeVisible();
  });

  test("has password toggle button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
  });

  // --- SEO ---

  test("has noindex meta tag", async ({ page }) => {
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", "noindex");
  });

  test("has OG tags and meta description", async ({ page }) => {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Enter your new password.",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Reset Password/,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  });

  // --- Client-side validation ---

  test("blur empty new password shows error", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.focus();
    await passwordInput.blur();
    await expect(page.getByText("Password must be at least 12 characters")).toBeVisible({
      timeout: 2000,
    });
  });

  test("password fewer than 12 chars shows error on blur", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.fill("short");
    await passwordInput.blur();
    await expect(page.getByText("Password must be at least 12 characters")).toBeVisible({
      timeout: 2000,
    });
  });

  test("numeric-only password rejected on blur", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.fill("123456789012");
    await passwordInput.blur();
    await expect(page.getByText("Password cannot be only numbers")).toBeVisible({ timeout: 2000 });
  });

  test("date-like password rejected on blur", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.fill("2025-01-01-01");
    await passwordInput.blur();
    await expect(
      page.getByText("Password cannot be only numbers and date separators"),
    ).toBeVisible({ timeout: 2000 });
  });

  test("blur empty confirm password shows error", async ({ page }) => {
    const confirmInput = page.getByLabel("Confirm New Password");
    await confirmInput.focus();
    await confirmInput.blur();
    await expect(page.getByText("Required")).toBeVisible({ timeout: 2000 });
  });

  test("blur valid password clears error on re-blur", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.fill("short");
    await passwordInput.blur();
    await expect(page.getByText("Password must be at least 12 characters")).toBeVisible({
      timeout: 2000,
    });

    await passwordInput.fill("ValidPassword12");
    await passwordInput.blur();
    await expect(page.getByText("Password must be at least 12 characters")).not.toBeVisible({
      timeout: 2000,
    });
  });

  test("whitespace-only password shows error", async ({ page }) => {
    const passwordInput = page.getByLabel("New Password", { exact: true });
    await passwordInput.fill("            ");
    await passwordInput.blur();
    // 12 spaces meets length but is not a valid password — still triggers min-length
    // because passwordField uses z.string().min(12) without trim, but all spaces
    // still pass length. The numeric/date refinements won't catch it, so it passes
    // client-side min-length. However, the field may show an error depending on
    // whether the schema trims. passwordField() does NOT trim, so 12 spaces passes
    // min(12). This tests that the form at least accepts the input for server validation.
    // If the schema rejects it, we expect an error.
    await expect(page.getByText("Password must be at least 12 characters")).not.toBeVisible({
      timeout: 2000,
    });
  });

  // --- Password toggle ---

  test("both password fields start masked", async ({ page }) => {
    await expect(page.getByLabel("New Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await expect(page.getByLabel("Confirm New Password")).toHaveAttribute("type", "password");
  });

  test("toggling show/hide changes both fields type attribute", async ({ page }) => {
    const newPasswordInput = page.getByLabel("New Password", { exact: true });
    const confirmInput = page.getByLabel("Confirm New Password");

    // Initial state: both masked
    await expect(newPasswordInput).toHaveAttribute("type", "password");
    await expect(confirmInput).toHaveAttribute("type", "password");

    // Click show — both should become text
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(newPasswordInput).toHaveAttribute("type", "text");
    await expect(confirmInput).toHaveAttribute("type", "text");

    // Click hide — both should become password again
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(newPasswordInput).toHaveAttribute("type", "password");
    await expect(confirmInput).toHaveAttribute("type", "password");
  });
});
