<script lang="ts">
  import type { SuperValidated } from "sveltekit-superforms";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { goto } from "$app/navigation";
  import { createSignInSchema, type SignInFormData } from "$lib/shared/forms/sign-in-schema.js";
  import { FormInput } from "$lib/client/components/forms/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import { authClient } from "$lib/client/stores/auth-client.js";
  import { EMAIL, PASSWORD } from "$lib/shared/forms/field-presets.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  type Props = {
    data: SuperValidated<SignInFormData>;
  };

  let { data }: Props = $props();

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
              await goto(`/verify-email?email=${encodeURIComponent(email)}&resent=true`);
              return;
            }

            // 429 = throttled
            if (status === 429) {
              serverError = "Too many sign-in attempts. Please try again later.";
              return;
            }

            serverError = result.error.message ?? "Invalid email or password.";
            return;
          }

          await goto("/");
        } catch {
          serverError = "Something went wrong. Please try again.";
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

<form method="POST" use:enhance autocomplete="off" class="flex flex-col gap-5">
  <FormInput {form} field="email" {...EMAIL} />

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

  {#if serverError}
    <p class="text-destructive text-sm">{serverError}</p>
  {/if}

  <Button type="submit" disabled={submitting} class="w-full">
    {submitting ? "Signing in..." : "Sign In"}
  </Button>

  <p class="text-muted-foreground text-center text-sm">
    Don't have an account?
    <a href="/sign-up" class="text-primary underline-offset-4 hover:underline">Sign up.</a>
  </p>
</form>
