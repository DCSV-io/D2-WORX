<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner/index.js";

  let { children } = $props();
</script>

<svelte:head>
  <link
    rel="icon"
    href={favicon}
  />
  <title>D2-WORX</title>
  <meta name="description" content="D2-WORX — Decisive Distributed Application Framework" />
</svelte:head>

<ModeWatcher />
<Toaster />

{@render children?.()}
