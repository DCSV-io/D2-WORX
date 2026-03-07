<script lang="ts">
  import { resolve } from "$app/paths";
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
  import LanguageSelector from "$lib/client/components/layout/language-selector.svelte";

  let { children } = $props();
</script>

<div class="relative flex min-h-screen items-center justify-center px-4">
  <div class="absolute right-4 top-4 flex items-center gap-1">
    <LanguageSelector />
    <ThemeToggle />
    <ThemeSelector />
  </div>

  <div class="w-full max-w-md">
    <div class="mb-8 flex justify-center">
      <a href={resolve("/")} class="flex items-center gap-2">
        <div
          class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold"
        >
          DW
        </div>
        <span class="text-xl font-semibold">DCSV WORX</span>
      </a>
    </div>

    {@render children?.()}
  </div>
</div>
