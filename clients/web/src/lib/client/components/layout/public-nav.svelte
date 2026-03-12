<script lang="ts">
  import { page } from "$app/stores";
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
  import LanguageSelector from "$lib/client/components/layout/language-selector.svelte";
  import { authClient } from "$lib/client/stores/auth-client.js";
  import { invalidateToken } from "$lib/client/rest/gateway-client.js";
  import * as m from "$lib/paraglide/messages.js";

  let signingOut = $state(false);

  async function handleSignOut() {
    signingOut = true;
    try {
      await authClient.signOut();
      invalidateToken();
      await invalidateAll();
    } finally {
      signingOut = false;
    }
  }
</script>

<nav class="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur-sm">
  <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href={resolve("/")} class="flex items-center gap-2">
      <div
        class="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold"
      >
        DW
      </div>
      <span class="text-lg font-semibold">{m.webclient_nav_brand()}</span>
    </a>

    <div class="flex items-center gap-2">
      <LanguageSelector />
      <ThemeToggle />
      <ThemeSelector />
      {#if $page.data.session}
        <Button variant="default" size="sm" href={resolve("/dashboard")}>{m.common_ui_dashboard()}</Button>
        <Button variant="outline" size="sm" onclick={handleSignOut} disabled={signingOut}>
          {m.common_ui_sign_out()}
        </Button>
      {:else}
        <Button variant="outline" size="sm" href={resolve("/sign-in")}>{m.common_ui_sign_in()}</Button>
        <Button variant="default" size="sm" href={resolve("/sign-up")}>{m.common_ui_sign_up()}</Button>
      {/if}
    </div>
  </div>
</nav>
