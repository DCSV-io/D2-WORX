import { expect, test } from "@playwright/test";

test.describe("contact form (/design/contact-form)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design/contact-form");
    // Wait for geo data to load (SSR text)
    await expect(page.getByText(/countries loaded/)).toBeVisible();
    // Wait for Svelte hydration to complete (event handlers attached)
    await page.waitForLoadState("networkidle");
  });

  test("page loads with heading and form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Contact Form");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByText("New Contact")).toBeVisible();
  });

  test("shows all required form fields", async ({ page }) => {
    await expect(page.getByLabel("First Name")).toBeVisible();
    await expect(page.getByLabel("Last Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Phone")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Country" })).toBeVisible();
    await expect(page.getByLabel("Street Address", { exact: true })).toBeVisible();
    await expect(page.getByLabel("City")).toBeVisible();
    await expect(page.getByLabel("Postal Code")).toBeVisible();
  });

  test("shows country count from live geo data", async ({ page }) => {
    await expect(page.getByText(/\d+ countries loaded/)).toBeVisible();
  });

  test("country combobox opens and shows searchable options", async ({ page }) => {
    await page.getByRole("combobox", { name: "Country" }).click();

    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option", { name: "Afghanistan" })).toBeVisible();
    await expect(page.getByRole("option", { name: "United States", exact: true })).toBeVisible();
  });

  test("selecting a country with subdivisions shows state field", async ({ page }) => {
    // State field should not be visible initially
    await expect(page.getByRole("combobox", { name: "State / Province" })).not.toBeVisible();

    // Open country combobox and select United States
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "United States", exact: true }).click();

    // State field should now appear
    await expect(page.getByRole("combobox", { name: "State / Province" })).toBeVisible();
  });

  test("changing country clears and repopulates state options", async ({ page }) => {
    // Select US first
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "United States", exact: true }).click();

    // State should be visible
    await expect(page.getByRole("combobox", { name: "State / Province" })).toBeVisible();

    // Now change country to Canada
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Canada" }).click();

    // State should still be visible (Canada has provinces)
    await expect(page.getByRole("combobox", { name: "State / Province" })).toBeVisible();
  });

  test("selecting a country without subdivisions hides state field", async ({ page }) => {
    // Select US to show state
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "United States", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "State / Province" })).toBeVisible();

    // Now select Singapore (no subdivisions)
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "Singapore" }).click();

    // State should be hidden
    await expect(page.getByRole("combobox", { name: "State / Province" })).not.toBeVisible();
  });

  test("submitting empty form shows validation errors", async ({ page }) => {
    await page.getByRole("button", { name: "Submit" }).click();

    // Should show validation errors for required fields
    await expect(page.getByText("Required").first()).toBeVisible({ timeout: 5000 });
  });

  test("back link navigates to design system page", async ({ page }) => {
    await page.getByRole("link", { name: /back to design system/i }).click();
    await expect(page).toHaveURL("/design");
  });

  test("reset button clears form fields", async ({ page }) => {
    const firstNameInput = page.getByLabel("First Name");
    await firstNameInput.fill("Jane");
    await expect(firstNameInput).toHaveValue("Jane");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(firstNameInput).toHaveValue("");
  });

  test("filling and submitting valid form shows success toast", async ({ page }) => {
    // Fill all required fields
    await page.getByLabel("First Name").fill("Jane");
    await page.getByLabel("Last Name").fill("Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Phone").fill("2025551234");

    // Select country
    await page.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "United States", exact: true }).click();

    // Select state
    await page.getByRole("combobox", { name: "State / Province" }).click();
    await page.getByRole("option", { name: "California" }).click();

    // Fill address
    await page.getByLabel("Street Address", { exact: true }).fill("123 Main St");
    await page.getByLabel("City").fill("San Francisco");
    await page.getByLabel("Postal Code").fill("94102");

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Should show success toast
    await expect(page.getByText(/validated successfully/i)).toBeVisible({ timeout: 5000 });
  });
});
