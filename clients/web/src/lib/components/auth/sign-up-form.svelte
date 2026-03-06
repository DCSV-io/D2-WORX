<script lang="ts">
  import type { SuperValidated } from "sveltekit-superforms";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { goto } from "$app/navigation";
  import { createSignUpSchema, type SignUpFormData } from "./sign-up-schema.js";
  import { FormInput } from "$lib/components/forms/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { useAsyncFieldCheck } from "$lib/forms/async-field-check.svelte.js";
  import { authClient } from "$lib/stores/auth-client.js";
  import { authApiCall } from "$lib/utils/auth-api.js";
  import {
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    CONFIRM_EMAIL,
    PASSWORD,
    CONFIRM_PASSWORD,
  } from "$lib/forms/field-presets.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  type Props = {
    data: SuperValidated<SignUpFormData>;
  };

  let { data }: Props = $props();

  const schema = createSignUpSchema();

  let submitting = $state(false);
  let serverError = $state("");

  const form = superForm(data, {
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
          const msg = result.error.message ?? "Sign-up failed.";
          // Map known BetterAuth errors to field-level errors
          if (msg.toLowerCase().includes("email")) {
            form.errors.update((e) => ({ ...e, email: [msg] }));
          } else if (msg.toLowerCase().includes("password")) {
            form.errors.update((e) => ({ ...e, password: [msg] }));
          } else {
            serverError = msg;
          }
          return;
        }

        await goto(`/verify-email?email=${encodeURIComponent(email)}`);
      } catch {
        serverError = "Something went wrong. Please try again.";
      } finally {
        submitting = false;
      }
    },
  });

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
      return { valid: result.data?.available !== false, errorMessage: "This email is already taken" };
    },
  });

  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
</script>

<form method="POST" use:enhance autocomplete="off" class="flex flex-col gap-5">
  <div class="grid gap-4 sm:grid-cols-2">
    <FormInput {form} field="firstName" {...FIRST_NAME} />
    <FormInput {form} field="lastName" {...LAST_NAME} />
  </div>

  <FormInput
    {form}
    field="email"
    {...EMAIL}
    status={emailCheck.status === "idle" ? undefined : emailCheck.status}
    onblur={emailCheck.check}
    oninput={emailCheck.reset}
  />

  <FormInput {form} field="confirmEmail" {...CONFIRM_EMAIL} />

  <FormInput {form} field="password" {...PASSWORD} type={showPassword ? "text" : "password"}>
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

  <Button type="submit" disabled={submitting} class="w-full">
    {submitting ? "Creating account..." : "Sign Up"}
  </Button>

  <p class="text-muted-foreground text-center text-sm">
    Already have an account?
    <a href="/sign-in" class="text-primary underline-offset-4 hover:underline">Sign in</a>
  </p>
</form>
