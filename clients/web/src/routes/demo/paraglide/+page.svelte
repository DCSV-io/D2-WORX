<script lang="ts">
  import { setLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages.js";
</script>

<svelte:head>
  <title>{m.webclient_demo_paraglide_title()} — {m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_demo_paraglide_description()}
  />
  <meta
    name="robots"
    content="noindex, nofollow"
  />
  <meta
    property="og:title"
    content="{m.webclient_demo_paraglide_title()} — {m.webclient_nav_brand()}"
  />
  <meta
    property="og:description"
    content={m.webclient_demo_paraglide_description()}
  />
  <meta
    property="og:type"
    content="website"
  />
</svelte:head>

<h1>{m.webclient_hero_title()}</h1>
<p>{m.webclient_hero_tagline()}</p>
<div class="mt-4 flex gap-2">
  <button onclick={() => setLocale("en")}>en</button>
  <button onclick={() => setLocale("es")}>es</button>
  <button onclick={() => setLocale("de")}>de</button>
  <button onclick={() => setLocale("fr")}>fr</button>
  <button onclick={() => setLocale("ja")}>ja</button>
</div>
<p class="text-muted-foreground mt-4 text-sm">
  Switch locale above. Non-English locales will show English fallback until translations are added.
</p>
