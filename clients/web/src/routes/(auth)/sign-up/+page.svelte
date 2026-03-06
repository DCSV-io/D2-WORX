<script lang="ts">
  import { SignUpForm } from "$lib/client/components/auth/index.js";
  import * as Card from "$lib/client/components/ui/card/index.js";

  let { data } = $props();
</script>

<svelte:head>
  <title>Sign Up — DCSV WORX</title>
</svelte:head>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-2xl">Create Account</Card.Title>
    <Card.Description>Fill in your details to get started.</Card.Description>
  </Card.Header>
  <Card.Content>
    <SignUpForm data={data.form} />
  </Card.Content>
</Card.Root>
