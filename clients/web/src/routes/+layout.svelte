<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import ThemeProvider from "$lib/components/theme-provider.svelte";
  import { setClientFingerprint } from "$lib/utils/gateway-client.js";

  let { data, children } = $props();

  $effect(() => {
    if (data.clientFingerprint) {
      setClientFingerprint(data.clientFingerprint);
    }
  });
</script>

<svelte:head>
  <link
    rel="icon"
    href={favicon}
  />
  <title>DCSV WORX</title>
  <meta name="description" content="DCSV WORX — Decisive Works" />
</svelte:head>

<ModeWatcher />
<ThemeProvider />
<Toaster />

{@render children?.()}
