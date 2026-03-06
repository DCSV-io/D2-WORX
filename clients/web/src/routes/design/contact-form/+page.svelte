<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { untrack } from "svelte";
  import { createContactSchema } from "./schema.js";
  import { FormInput } from "$lib/client/components/forms/index.js";
  import FormCombobox from "$lib/client/components/forms/form-combobox.svelte";
  import FormPhoneInput from "$lib/client/components/forms/form-phone-input.svelte";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import * as Card from "$lib/client/components/ui/card/index.js";
  import { toast } from "svelte-sonner";
  import {
    FIRST_NAME,
    LAST_NAME,
    EMAIL,
    PHONE,
    COUNTRY,
    STATE,
    STREET1,
    STREET2,
    STREET3,
    CITY,
    POSTAL_CODE,
  } from "$lib/shared/forms/field-presets.js";
  import { useCountryState } from "$lib/client/forms/country-state.svelte.js";
  import { useAddressLines } from "$lib/client/forms/address-lines.svelte.js";
  import { useAsyncFieldCheck } from "$lib/client/forms/async-field-check.svelte.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  let { data } = $props();

  // Page data is stable for the component lifetime (navigation remounts).
  // Use untrack to read the initial values without subscribing to changes.
  const { form: formDefaults, countries, subdivisionsByCountry, countriesWithSubdivisions } =
    untrack(() => data);

  const schema = createContactSchema(new Set(countriesWithSubdivisions));

  const form = superForm(formDefaults, {
    id: "contact-form",
    validators: zodClient(schema),
    onUpdated({ form: f }) {
      if (f.valid && f.message) {
        toast.success(f.message as string);
      }
    },
  });

  const { enhance } = form;

  // Composable returns use getter-based reactivity — do NOT destructure
  // (destructuring evaluates getters once and loses $state tracking).
  const countryState = useCountryState({ form, subdivisionsByCountry });
  const addressLines = useAddressLines({ form });

  const emailCheck = useAsyncFieldCheck({
    form,
    field: "email",
    preCheck: (v) => !!v && v.includes("@"),
    async checker(email) {
      const res = await fetch(`/design/api/check-email?email=${encodeURIComponent(email)}`);
      const { available } = await res.json();
      return { valid: available, errorMessage: "This email is already taken" };
    },
  });
</script>

<svelte:head>
  <title>Contact Form Demo — DCSV WORX</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <a
      href="/design"
      class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon class="size-4" />
      Back to Design System
    </a>
    <h1 class="text-2xl font-bold tracking-tight">Contact Form</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Demonstrates Superforms + Formsnap with geo reference data, cascading selects,
      phone formatting, and cross-field validation.
    </p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>New Contact</Card.Title>
      <Card.Description>
        All fields use live geo reference data from the 4-tier cache
        (Memory &rarr; Redis &rarr; Disk &rarr; gRPC).
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form method="POST" use:enhance autocomplete="off" class="flex flex-col gap-5">
        <!-- Name row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="firstName" {...FIRST_NAME} />
          <FormInput {form} field="lastName" {...LAST_NAME} />
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

        <!-- Phone with country selector -->
        <FormPhoneInput
          {form}
          field="phone"
          label={PHONE.label}
          countries={countries}
          defaultCountry="US"
          description={PHONE.description}
        />

        <!-- Country combobox -->
        <FormCombobox
          {form}
          field="country"
          {...COUNTRY}
          options={countries}
          onValueChange={countryState.handleCountryChange}
        />

        <!-- State/Province — conditionally shown -->
        {#if countryState.showState}
          <FormCombobox
            {form}
            field="state"
            {...STATE}
            options={countryState.stateOptions}
          />
        {/if}

        <!-- Street address with expandable extra lines -->
        <FormInput {form} field="street1" {...STREET1}>
          {#snippet labelRight()}
            <button
              type="button"
              onclick={addressLines.toggleExtraLines}
              class="text-sm text-muted-foreground hover:text-foreground"
            >
              {addressLines.showExtraLines ? "- Fewer address lines" : "+ More address lines"}
            </button>
          {/snippet}
        </FormInput>
        {#if addressLines.showExtraLines}
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput {form} field="street2" {...STREET2} />
            <FormInput {form} field="street3" {...STREET3} />
          </div>
        {/if}

        <!-- City + Postal Code row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="city" {...CITY} />
          <FormInput {form} field="postalCode" {...POSTAL_CODE} />
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="reset">Reset</Button>
          <Button type="submit">Submit</Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>

  <!-- Data source indicator -->
  <p class="mt-4 text-center text-xs text-muted-foreground">
    {countries.length} countries loaded (live geo reference data)
  </p>
</div>
