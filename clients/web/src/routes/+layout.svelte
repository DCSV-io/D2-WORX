<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/client/components/ui/sonner/index.js";
  import ThemeProvider from "$lib/client/components/theme-provider.svelte";
  import NavigationProgress from "$lib/client/components/layout/navigation-progress.svelte";
  import { setClientFingerprint } from "$lib/client/rest/gateway-client.js";
  import { generateClientFingerprint } from "$lib/client/utils/fingerprint.js";

  let { data, children } = $props();

  $effect(() => {
    generateClientFingerprint().then((fp) => setClientFingerprint(fp));
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
<NavigationProgress />

{@render children?.()}
