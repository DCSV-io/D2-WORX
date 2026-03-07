<script lang="ts">
  import { SignUpForm } from "$lib/client/components/auth/index.js";
  import * as Card from "$lib/client/components/ui/card/index.js";
  import * as m from "$lib/paraglide/messages.js";

  let { data } = $props();
</script>

<svelte:head>
  <title>{m.auth_sign_up_title()} — {m.webclient_nav_brand()}</title>
</svelte:head>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-2xl">{m.auth_sign_up_title()}</Card.Title>
    <Card.Description>{m.auth_sign_up_description()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <SignUpForm data={data.form} />
  </Card.Content>
</Card.Root>
