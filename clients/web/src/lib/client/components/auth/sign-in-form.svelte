<script lang="ts">
  import type { SuperValidated } from "sveltekit-superforms";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createSignInSchema, type SignInFormData } from "$lib/shared/forms/sign-in-schema.js";
  import { FormInput } from "$lib/client/components/forms/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import TextLink from "$lib/client/components/ui/text-link.svelte";
  import { authClient } from "$lib/client/stores/auth-client.js";
  import { EMAIL, PASSWORD } from "$lib/shared/forms/field-presets.js";
  import * as m from "$lib/paraglide/messages.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  type Props = {
    data: SuperValidated<SignInFormData>;
    returnTo?: string | null;
  };

  let { data, returnTo }: Props = $props();

  const schema = createSignInSchema();

  let submitting = $state(false);
  let serverError = $state("");

  function initForm() {
    return superForm(data, {
      id: "sign-in-form",
      validators: zodClient(schema),
      SPA: true,
      async onUpdate({ form: f }) {
        if (!f.valid) return;

        submitting = true;
        serverError = "";

        try {
          const { email, password } = f.data;
          const result = await authClient.signIn.email({ email, password });

          if (result.error) {
            const status = result.error.status;

            // 403 = email not verified → redirect to verify-email page
            if (status === 403) {
              // eslint-disable-next-line svelte/no-navigation-without-resolve -- verify-email route not yet created
              await goto(`/verify-email?email=${encodeURIComponent(email)}&resent=true`);
              return;
            }

            // 429 = throttled
            if (status === 429) {
              serverError = m.auth_errors_SIGN_IN_THROTTLED();
              return;
            }

            serverError = result.error.message ?? m.auth_sign_in_invalid_credentials();
            return;
          }

          const dest =
            returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
              ? returnTo
              : "/dashboard";
          // eslint-disable-next-line svelte/no-navigation-without-resolve -- dynamic returnTo from query params
          await goto(dest);
        } catch {
          serverError = m.common_errors_unknown();
        } finally {
          submitting = false;
        }
      },
    });
  }

  const form = initForm();

  const { enhance } = form;

  let showPassword = $state(false);
</script>

<form
  method="POST"
  use:enhance
  autocomplete="off"
  class="flex flex-col gap-5"
>
  <FormInput
    {form}
    field="email"
    {...EMAIL}
  />

  <FormInput
    {form}
    field="password"
    {...PASSWORD}
    type={showPassword ? "text" : "password"}
  >
    {#snippet inputAction()}
      <button
        type="button"
        onclick={() => (showPassword = !showPassword)}
        class="text-muted-foreground hover:text-foreground"
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {#if showPassword}
          <EyeOffIcon class="size-4" />
        {:else}
          <EyeIcon class="size-4" />
        {/if}
      </button>
    {/snippet}
  </FormInput>

  {#if serverError}
    <p class="text-destructive text-sm">{serverError}</p>
  {/if}

  <Button
    type="submit"
    disabled={submitting}
    class="w-full"
  >
    {submitting ? m.auth_sign_in_submitting() : m.auth_sign_in_submit()}
  </Button>

  <p class="text-muted-foreground text-center text-sm">
    {m.auth_sign_in_no_account()}
    <TextLink href={resolve("/sign-up")}>{m.auth_sign_in_link()}</TextLink>
  </p>

  <p class="text-muted-foreground text-center text-sm">
    <TextLink href={resolve("/forgot-password")}>{m.auth_sign_in_forgot_password()}</TextLink>
  </p>
</form>
