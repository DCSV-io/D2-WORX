<script lang="ts">
  import { resolve } from "$app/paths";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
</script>

<nav class="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur-sm">
  <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href={resolve("/")} class="flex items-center gap-2">
      <div
        class="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold"
      >
        DW
      </div>
      <span class="text-lg font-semibold">DCSV WORX</span>
    </a>

    <div class="flex items-center gap-2">
      <ThemeToggle />
      <ThemeSelector />
      <Button variant="outline" size="sm" href="/sign-in">Sign In</Button>
      <Button variant="default" size="sm" href="/sign-up">Sign Up</Button>
    </div>
  </div>
</nav>
