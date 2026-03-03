import { expect, test } from "@playwright/test";

test.describe("route navigation", () => {
  test("/ renders the public landing page", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("DCSV WORX");
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("/dashboard renders app shell with sidebar and content", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("h1")).toContainText("Dashboard");
    // Sidebar wrapper should be present
    await expect(page.locator("[data-slot='sidebar-wrapper']")).toBeVisible();
  });

  test("/settings renders within app shell", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.locator("h1")).toContainText("Settings");
    await expect(page.locator("[data-slot='sidebar-wrapper']")).toBeVisible();
  });

  test("/profile renders within app shell", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.locator("h1")).toContainText("Profile");
    await expect(page.locator("[data-slot='sidebar-wrapper']")).toBeVisible();
  });

  test("/sign-in renders centered card layout without sidebar", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.locator("[data-slot='card-title']").getByText("Sign In")).toBeVisible();
    // No sidebar wrapper in auth layout
    await expect(page.locator("[data-slot='sidebar-wrapper']")).not.toBeVisible();
  });

  test("/welcome renders onboarding layout without sidebar", async ({ page }) => {
    await page.goto("/welcome");

    await expect(page.getByText("Welcome to DCSV WORX")).toBeVisible();
    await expect(page.locator("[data-slot='sidebar-wrapper']")).not.toBeVisible();
  });

  test("unknown routes still show 404", async ({ page }) => {
    const response = await page.goto("/nonexistent-route-xyz");
    expect(response?.status()).toBe(404);

    await expect(page.locator("h1")).toContainText("404");
  });
});
