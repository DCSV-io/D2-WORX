<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { onMount } from "svelte";
  import * as Card from "$lib/client/components/ui/card/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import * as m from "$lib/paraglide/messages.js";

  const error = $derived($page.url.searchParams.get("error"));
  const success = $derived(!error);
  let countdown = $state(5);

  onMount(() => {
    const interval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(interval);
        goto(resolve(success ? "/dashboard" : "/"));
      }
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title
    >{success ? m.auth_email_verified_title() : m.auth_email_failed_title()} — DCSV WORX</title
  >
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center px-4">
  <div class="w-full max-w-md">
    <div class="mb-8 flex justify-center">
      <a href={resolve("/")} class="flex items-center gap-2">
        <div
          class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold"
        >
          DW
        </div>
        <span class="text-xl font-semibold">DCSV WORX</span>
      </a>
    </div>

    <Card.Root>
      <Card.Header class="text-center">
        <div
          class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full {success
            ? 'bg-success/10'
            : 'bg-destructive/10'}"
        >
          {#if success}
            <CircleCheckIcon class="text-success size-6" />
          {:else}
            <CircleXIcon class="text-destructive size-6" />
          {/if}
        </div>
        <Card.Title class="text-2xl">
          {success ? m.auth_email_verified_title() : m.auth_email_failed_title()}
        </Card.Title>
      </Card.Header>
      <Card.Content class="flex flex-col gap-3 text-center">
        <p class="text-sm">
          {success ? m.auth_email_verified_description() : m.auth_email_failed_description()}
        </p>
        <p class="text-muted-foreground text-sm">
          {success
            ? m.auth_email_verified_redirect({ seconds: String(countdown) })
            : m.auth_email_failed_redirect({ seconds: String(countdown) })}
        </p>
      </Card.Content>
      <Card.Footer>
        {#if success}
          <Button href="/dashboard" class="w-full">{m.common_ui_dashboard()}</Button>
        {:else}
          <Button variant="outline" href={resolve("/")} class="w-full"
            >{m.common_ui_sign_in()}</Button
          >
        {/if}
      </Card.Footer>
    </Card.Root>
  </div>
</div>
