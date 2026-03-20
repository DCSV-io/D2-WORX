<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
  import { authClient } from "$lib/client/stores/auth-client.js";
  import { invalidateToken } from "$lib/client/rest/gateway-client.js";
  import * as m from "$lib/paraglide/messages.js";

  let { children } = $props();

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

<svelte:head>
  <meta
    name="robots"
    content="noindex, nofollow"
  />
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center px-4">
  <div class="absolute top-4 right-4 flex items-center gap-1">
    <ThemeToggle />
    <ThemeSelector />
    <Button
      variant="outline"
      size="sm"
      onclick={handleSignOut}
      disabled={signingOut}
    >
      {m.common_ui_sign_out()}
    </Button>
  </div>

  <div class="w-full max-w-2xl">
    <div class="mb-8 flex justify-center">
      <a
        href={resolve("/")}
        class="flex items-center gap-2"
      >
        <div
          class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold"
        >
          DW
        </div>
        <span class="text-xl font-semibold">{m.webclient_nav_brand()}</span>
      </a>
    </div>

    {@render children?.()}
  </div>
</div>
