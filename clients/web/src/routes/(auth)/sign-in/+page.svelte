<script lang="ts">
  import { SignInForm } from "$lib/components/auth/index.js";
  import * as Card from "$lib/components/ui/card/index.js";

  let { data } = $props();
</script>

<svelte:head>
  <title>Sign In — DCSV WORX</title>
</svelte:head>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-2xl">Sign In</Card.Title>
    <Card.Description>Enter your credentials to access your account.</Card.Description>
  </Card.Header>
  <Card.Content>
    <SignInForm data={data.form} />
  </Card.Content>
</Card.Root>
