import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import PublicNav from "./public-nav.svelte";

vi.mock("$app/stores", () => ({
  page: {
    subscribe: (fn: (value: unknown) => void) => {
      fn({ data: { session: null } });
      return () => {};
    },
  },
}));

vi.mock("$app/navigation", () => ({
  invalidateAll: () => Promise.resolve(),
}));

vi.mock("$app/paths", () => ({
  resolve: (path: string) => path,
}));

vi.mock("$lib/client/stores/auth-client.js", () => ({
  authClient: { signOut: () => Promise.resolve() },
}));

vi.mock("$lib/paraglide/runtime", () => ({
  getLocale: () => "en",
  setLocale: () => {},
}));

vi.mock("$lib/paraglide/messages.js", () => ({
  webclient_nav_brand: () => "DCSV WORX",
  common_ui_sign_in: () => "Sign In",
  common_ui_sign_up: () => "Sign Up",
  common_ui_dashboard: () => "Dashboard",
  common_ui_sign_out: () => "Sign Out",
  webclient_language_label: () => "Language",
  webclient_language_english: () => "English",
  webclient_language_spanish: () => "Spanish",
  webclient_language_french: () => "French",
  webclient_language_german: () => "German",
  webclient_language_japanese: () => "Japanese",
  webclient_theme_toggle_label: () => "Toggle theme",
  webclient_theme_light: () => "Light",
  webclient_theme_dark: () => "Dark",
  webclient_theme_system: () => "System",
}));

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
