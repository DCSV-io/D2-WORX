<script lang="ts">
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import { mode, toggleMode, setMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button/index.js";

  function cycle() {
    const current = mode.current;
    if (current === "light") {
      setMode("dark");
    } else if (current === "dark") {
      setMode("system");
    } else {
      setMode("light");
    }
  }
</script>

<Button variant="ghost" size="icon" onclick={cycle} aria-label="Toggle theme">
  {#if mode.current === "light"}
    <SunIcon class="size-4" />
  {:else if mode.current === "dark"}
    <MoonIcon class="size-4" />
  {:else}
    <MonitorIcon class="size-4" />
  {/if}
</Button>
