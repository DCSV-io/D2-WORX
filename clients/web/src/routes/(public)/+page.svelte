<script lang="ts">
  import { Button } from "$lib/client/components/ui/button/index.js";
  import * as m from "$lib/paraglide/messages.js";
</script>

<div class="flex flex-col items-center justify-center py-20 text-center">
  <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">{m.webclient_hero_title()}</h1>
  <p class="text-muted-foreground mt-4 max-w-lg text-lg">
    {m.webclient_hero_tagline()}
  </p>
  <div class="mt-8 flex gap-4">
    <Button href="/sign-up" size="lg">{m.common_ui_get_started()}</Button>
    <Button href="/design" variant="outline" size="lg">{m.common_ui_design_system()}</Button>
  </div>
</div>
