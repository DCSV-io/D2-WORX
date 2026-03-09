<script lang="ts">
  import { ForgotPasswordForm } from "$lib/client/components/auth/index.js";
  import * as Card from "$lib/client/components/ui/card/index.js";
  import * as m from "$lib/paraglide/messages.js";

  let { data } = $props();
</script>

<svelte:head>
  <title>{m.auth_forgot_password_title()} — {m.webclient_nav_brand()}</title>
</svelte:head>

<Card.Root>
  <ForgotPasswordForm data={data.form} />
</Card.Root>
