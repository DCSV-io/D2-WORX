<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/client/components/ui/sonner/index.js";
  import ThemeProvider from "$lib/client/components/theme-provider.svelte";
  import NavigationProgress from "$lib/client/components/layout/navigation-progress.svelte";
  import { setClientFingerprint } from "$lib/client/rest/gateway-client.js";
  import { generateClientFingerprint } from "$lib/client/utils/fingerprint.js";
  import { setFaroUser, resetFaroUser } from "$lib/client/telemetry/faro.js";
  import * as m from "$lib/paraglide/messages.js";

  let { data, children } = $props();

  $effect(() => {
    generateClientFingerprint().then((fp) => setClientFingerprint(fp));
  });

  // Enrich Faro telemetry with user ID + username for session correlation (no PII).
  $effect(() => {
    if (data.user) {
      setFaroUser(data.user.id, data.user.username);
    } else {
      resetFaroUser();
    }
  });
</script>

<svelte:head>
  <link
    rel="icon"
    href={favicon}
  />
  <title>{m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_hero_tagline()}
  />
</svelte:head>

<ModeWatcher />
<ThemeProvider />
<Toaster />
<NavigationProgress />

{@render children?.()}
