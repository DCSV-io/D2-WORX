<script lang="ts">
  import { resolve } from "$app/paths";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { untrack } from "svelte";
  import { createSignUpSchema as createSignupSchema } from "$lib/shared/forms/sign-up-schema.js";
  import { FormInput } from "$lib/client/components/forms/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import * as Card from "$lib/client/components/ui/card/index.js";
  import { toast } from "svelte-sonner";
  import {
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    CONFIRM_EMAIL,
    PASSWORD,
    CONFIRM_PASSWORD,
  } from "$lib/shared/forms/field-presets.js";
  import { useAsyncFieldCheck } from "$lib/client/forms/async-field-check.svelte.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import * as m from "$lib/paraglide/messages.js";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";

  let { data } = $props();

  const { form: formDefaults } = untrack(() => data);

  const schema = createSignupSchema();

  const form = superForm(formDefaults, {
    id: "signup-form",
    validators: zodClient(schema),
    onUpdated({ form: f }) {
      if (f.valid && f.message) {
        toast.success(f.message as string);
      }
    },
  });

  const { enhance } = form;

  const emailCheck = useAsyncFieldCheck({
    form,
    field: "email",
    preCheck: (v) => !!v && v.includes("@"),
    async checker(email) {
      const res = await fetch(`/debug/design/api/check-email?email=${encodeURIComponent(email)}`);
      const { available } = await res.json();
      return { valid: available, errorMessage: "This email is already taken" };
    },
  });

  // Show/hide toggles for password fields (independent state)
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
</script>

<svelte:head>
  <title>{m.webclient_design_signup_form_title()} — {m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_design_signup_form_description()}
  />
  <meta
    name="robots"
    content="noindex, nofollow"
  />
  <meta
    property="og:title"
    content="{m.webclient_design_signup_form_title()} — {m.webclient_nav_brand()}"
  />
  <meta
    property="og:description"
    content={m.webclient_design_signup_form_description()}
  />
  <meta
    property="og:type"
    content="website"
  />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <a
      href={resolve("/debug/design")}
      class="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeftIcon class="size-4" />
      {m.webclient_design_back_to_design()}
    </a>
    <h1 class="text-2xl font-bold tracking-tight">{m.webclient_design_signup_form_heading()}</h1>
    <p class="text-muted-foreground mt-1 text-sm">
      {m.webclient_design_signup_form_demo_description()}
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>{m.auth_sign_up_title()}</Card.Title>
      <Card.Description>
        {m.webclient_design_signup_card_description()}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        use:enhance
        autocomplete="off"
        class="flex flex-col gap-5"
      >
        <!-- Name row -->
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

        <!-- Email with async availability check -->
        <FormInput
          {form}
          field="email"
          {...EMAIL}
          status={emailCheck.status === "idle" ? undefined : emailCheck.status}
          onblur={emailCheck.check}
          oninput={emailCheck.reset}
        />

        <!-- Confirm Email -->
        <FormInput
          {form}
          field="confirmEmail"
          {...CONFIRM_EMAIL}
        />

        <!-- Password with show/hide toggle -->
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

        <!-- Confirm Password with independent show/hide toggle -->
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

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            type="reset">{m.common_ui_reset()}</Button
          >
          <Button type="submit">{m.common_ui_sign_up()}</Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</div>
