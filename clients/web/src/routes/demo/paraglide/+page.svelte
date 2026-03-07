<script lang="ts">
  import { setLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages.js";
</script>

<h1>{m.webclient_hero_title()}</h1>
<p>{m.webclient_hero_tagline()}</p>
<div class="mt-4 flex gap-2">
  <button onclick={() => setLocale("en")}>en</button>
  <button onclick={() => setLocale("es")}>es</button>
  <button onclick={() => setLocale("de")}>de</button>
  <button onclick={() => setLocale("fr")}>fr</button>
  <button onclick={() => setLocale("ja")}>ja</button>
</div>
<p class="mt-4 text-sm text-muted-foreground">
  Switch locale above. Non-English locales will show English fallback until translations are added.
</p>
