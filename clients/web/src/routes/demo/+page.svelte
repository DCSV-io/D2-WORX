<script lang="ts">
  import { resolve } from "$app/paths";
  import * as m from "$lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.webclient_demo_title()} — {m.webclient_nav_brand()}</title>
  <meta name="description" content={m.webclient_demo_description()} />
  <meta name="robots" content="noindex, nofollow" />
  <meta property="og:title" content="{m.webclient_demo_title()} — {m.webclient_nav_brand()}" />
  <meta property="og:description" content={m.webclient_demo_description()} />
  <meta property="og:type" content="website" />
</svelte:head>

<a href={resolve("/demo/paraglide")}>paraglide</a>
