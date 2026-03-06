import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import PublicNav from "./public-nav.svelte";

describe("public-nav.svelte", () => {
  it("should render the DCSV WORX logo text", async () => {
    render(PublicNav);

    await expect.element(page.getByText("DCSV WORX")).toBeInTheDocument();
  });

  it("should render the Sign In link pointing to /sign-in", async () => {
    render(PublicNav);

    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect.element(signInLink).toBeInTheDocument();
    await expect.element(signInLink).toHaveAttribute("href", "/sign-in");
  });

  it("should render the theme toggle", async () => {
    render(PublicNav);

    const themeToggle = page.getByRole("button", { name: /toggle theme/i });
    await expect.element(themeToggle).toBeInTheDocument();
  });
});
