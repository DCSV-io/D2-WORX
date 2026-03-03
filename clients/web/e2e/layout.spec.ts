import { expect, test } from "@playwright/test";

test.describe("layout rendering", () => {
  test("app layout has sidebar with nav links", async ({ page }) => {
    await page.goto("/dashboard");

    // Sidebar should contain nav links
    const sidebar = page.locator("[data-slot='sidebar']");
    await expect(sidebar.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Profile" })).toBeVisible();
  });

  test("sidebar nav links navigate correctly", async ({ page }) => {
    await page.goto("/dashboard");

    // Navigate to Settings via sidebar
    const sidebar = page.locator("[data-slot='sidebar']");
    await sidebar.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.locator("h1")).toContainText("Settings");

    // Navigate to Profile via sidebar
    await sidebar.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL("/profile");
    await expect(page.locator("h1")).toContainText("Profile");

    // Navigate back to Dashboard
    await sidebar.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("app header shows theme toggle", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByRole("button", { name: /toggle theme/i })).toBeVisible();
  });

  test("app header shows sidebar trigger", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("button", { name: /toggle sidebar/i }).first(),
    ).toBeVisible();
  });

  test("auth layout is centered with no sidebar", async ({ page }) => {
    await page.goto("/sign-in");

    // Should show DCSV WORX branding
    await expect(page.getByText("DCSV WORX")).toBeVisible();
    // Should show theme toggle
    await expect(page.getByRole("button", { name: /toggle theme/i })).toBeVisible();
    // No sidebar
    await expect(page.locator("[data-slot='sidebar']")).not.toBeVisible();
  });

  test("onboarding layout is centered with no sidebar", async ({ page }) => {
    await page.goto("/welcome");

    // Should show DCSV WORX branding (first match — the logo)
    await expect(page.getByText("DCSV WORX").first()).toBeVisible();
    // Should show theme toggle
    await expect(page.getByRole("button", { name: /toggle theme/i })).toBeVisible();
    // No sidebar
    await expect(page.locator("[data-slot='sidebar']")).not.toBeVisible();
  });

  test("public layout has nav and footer", async ({ page }) => {
    await page.goto("/");

    // Nav with branding
    await expect(page.locator("nav").getByText("DCSV WORX")).toBeVisible();
    // Footer with copyright
    await expect(page.locator("footer").getByText(/DCSV/)).toBeVisible();
  });
});
