<script lang="ts">
  import type { SuperValidated } from "sveltekit-superforms";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { createSignUpSchema, type SignUpFormData } from "$lib/shared/forms/sign-up-schema.js";
  import { FormInput } from "$lib/client/components/forms/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import TextLink from "$lib/client/components/ui/text-link.svelte";
  import { useAsyncFieldCheck } from "$lib/client/forms/async-field-check.svelte.js";
  import { authClient } from "$lib/client/stores/auth-client.js";
  import { authApiCall } from "$lib/client/rest/auth-gateway-client.js";
  import {
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    CONFIRM_EMAIL,
    PASSWORD,
    CONFIRM_PASSWORD,
  } from "$lib/shared/forms/field-presets.js";
  import * as m from "$lib/paraglide/messages.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  type Props = {
    data: SuperValidated<SignUpFormData>;
  };

  let { data }: Props = $props();

  const schema = createSignUpSchema();

  let submitting = $state(false);
  let serverError = $state("");

  function initForm() {
    return superForm(data, {
      id: "sign-up-form",
      validators: zodClient(schema),
      SPA: true,
      async onUpdate({ form: f }) {
        if (!f.valid) return;

        submitting = true;
        serverError = "";

        try {
          const { firstName, lastName, email, password } = f.data;
          const result = await authClient.signUp.email({
            name: `${firstName} ${lastName}`,
            email,
            password,
          });

          if (result.error) {
            // Always show server errors at the form level — field-level errors
            // get cleared by client-side revalidation on the next interaction.
            serverError = result.error.message ?? m.auth_sign_in_sign_up_failed();
            f.valid = false;
            return;
          }

          await goto(`${resolve("/verify-email")}?email=${encodeURIComponent(email)}`);
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

  const emailCheck = useAsyncFieldCheck({
    form,
    field: "email",
    preCheck: (v) => !!v && v.includes("@"),
    async checker(email) {
      const result = await authApiCall<{ available: boolean }>(
        `/api/auth/check-email?email=${encodeURIComponent(email)}`,
      );
      if (!result.success) return { valid: true }; // Fail-open on server error
      return {
        valid: result.data?.available !== false,
        errorMessage: m.auth_errors_EMAIL_ALREADY_TAKEN(),
      };
    },
  });

  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
</script>

<form
  method="POST"
  use:enhance
  autocomplete="off"
  class="flex flex-col gap-5"
>
  <div class="grid gap-4 sm:grid-cols-2">
    <FormInput
      {form}
      field="firstName"
      {...FIRST_NAME}
    />
    <FormInput
      {form}
      field="lastName"
      {...LAST_NAME}
    />
  </div>

  <FormInput
    {form}
    field="email"
    {...EMAIL}
    status={emailCheck.status === "idle" ? undefined : emailCheck.status}
    onblur={emailCheck.check}
    oninput={emailCheck.reset}
  />

  <FormInput
    {form}
    field="confirmEmail"
    {...CONFIRM_EMAIL}
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

  <FormInput
    {form}
    field="confirmPassword"
    {...CONFIRM_PASSWORD}
    type={showConfirmPassword ? "text" : "password"}
  >
    {#snippet inputAction()}
      <button
        type="button"
        onclick={() => (showConfirmPassword = !showConfirmPassword)}
        class="text-muted-foreground hover:text-foreground"
        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
      >
        {#if showConfirmPassword}
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
    {submitting ? m.auth_sign_up_submitting() : m.auth_sign_up_submit()}
  </Button>

  <p class="text-muted-foreground text-center text-sm">
    {m.auth_sign_up_has_account()}
    <TextLink href={resolve("/sign-in")}>{m.auth_sign_up_link()}</TextLink>
  </p>
</form>
