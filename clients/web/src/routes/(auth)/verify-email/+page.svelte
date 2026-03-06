<script lang="ts">
  import { page } from "$app/stores";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import MailIcon from "@lucide/svelte/icons/mail";

  const email = $derived($page.url.searchParams.get("email") ?? "");
  const resent = $derived($page.url.searchParams.get("resent") === "true");
</script>

<svelte:head>
  <title>Verify Email — DCSV WORX</title>
</svelte:head>

<Card.Root>
  <Card.Header class="text-center">
    <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
      <MailIcon class="size-6 text-muted-foreground" />
    </div>
    <Card.Title class="text-2xl">Check Your Email</Card.Title>
  </Card.Header>
  <Card.Content class="flex flex-col gap-3 text-center">
    {#if resent}
      <p class="text-sm">
        Your email hasn't been verified yet. We've resent the verification link.
      </p>
    {:else}
      <p class="text-sm">We've sent a verification link to your email.</p>
    {/if}
    {#if email}
      <p class="font-medium">{email}</p>
    {/if}
    <p class="text-muted-foreground text-sm">
      Click the link in the email to activate your account.
    </p>
  </Card.Content>
  <Card.Footer>
    <Button variant="outline" href="/sign-in" class="w-full">Back to Sign In</Button>
  </Card.Footer>
</Card.Root>
