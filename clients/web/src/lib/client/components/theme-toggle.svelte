<script lang="ts">
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { mode, userPrefersMode, setMode } from "mode-watcher";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/client/components/ui/dropdown-menu/index.js";
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
      >
        {#if mode.current === "light"}
          <SunIcon class="size-4" />
        {:else}
          <MoonIcon class="size-4" />
        {/if}
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Item onclick={() => setMode("light")}>
      <SunIcon class="mr-2 size-4" />
      Light
      {#if userPrefersMode.current === "light"}
        <CheckIcon class="ml-auto size-4" />
      {/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => setMode("dark")}>
      <MoonIcon class="mr-2 size-4" />
      Dark
      {#if userPrefersMode.current === "dark"}
        <CheckIcon class="ml-auto size-4" />
      {/if}
    </DropdownMenu.Item>
    <DropdownMenu.Item onclick={() => setMode("system")}>
      <MonitorIcon class="mr-2 size-4" />
      System
      {#if userPrefersMode.current === "system"}
        <CheckIcon class="ml-auto size-4" />
      {/if}
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
