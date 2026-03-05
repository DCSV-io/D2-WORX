<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { createContactSchema } from "./schema.js";
  import { FormInput } from "$lib/components/forms/index.js";
  import FormCombobox from "$lib/components/forms/form-combobox.svelte";
  import FormPhoneInput from "$lib/components/forms/form-phone-input.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { toast } from "svelte-sonner";
  import type { SubdivisionOption } from "$lib/forms/geo-ref-data.js";
  import type { FieldStatus } from "$lib/forms/field-status.js";
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
  } from "$lib/forms/field-presets.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  let { data } = $props();

  const schema = createContactSchema(new Set(data.countriesWithSubdivisions));

  const form = superForm(data.form, {
    id: "contact-form",
    validators: zodClient(schema),
    onUpdated({ form: f }) {
      if (f.valid && f.message) {
        toast.success(f.message as string);
      }
    },
  });

  const { enhance, form: formData, errors } = form;

  // --- Cascading state logic ---
  let stateOptions = $state<SubdivisionOption[]>([]);
  let showState = $derived(stateOptions.length > 0);

  function handleCountryChange(countryCode: string) {
    ($formData as Record<string, string>).state = "";
    stateOptions = countryCode ? (data.subdivisionsByCountry[countryCode] ?? []) : [];

    // Revalidate postal code when country changes (format may differ)
    const postalCode = ($formData as Record<string, string>).postalCode;
    if (postalCode) {
      form.validate("postalCode");
    }
  }

  $effect(() => {
    const country = ($formData as Record<string, string>).country;
    if (country) {
      stateOptions = data.subdivisionsByCountry[country] ?? [];
    }
  });

  // --- Expandable address lines ---
  let showExtraLines = $state(false);

  function toggleExtraLines() {
    showExtraLines = !showExtraLines;
    if (!showExtraLines) {
      ($formData as Record<string, string>).street2 = "";
      ($formData as Record<string, string>).street3 = "";
    }
  }

  // --- Async email availability check ---
  let emailStatus = $state<FieldStatus>("idle");

  async function checkEmailAvailability() {
    const email = ($formData as Record<string, string>).email;
    if (!email || !email.includes("@")) return;

    // Skip if client validation already failed (errors populated by validate-on-blur)
    const clientErrors = ($errors as Record<string, string[]>)?.email;
    if (clientErrors?.length) return;

    emailStatus = "validating";
    try {
      const res = await fetch(`/design/api/check-email?email=${encodeURIComponent(email)}`);
      const { available } = await res.json();
      if (!available) {
        emailStatus = "invalid";
        errors.update((e) => ({ ...e, email: ["This email is already taken"] }));
      } else {
        emailStatus = "valid";
      }
    } catch {
      emailStatus = "idle";
    }
  }

  function resetEmailStatus() {
    emailStatus = "idle";
  }
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
          status={emailStatus === "idle" ? undefined : emailStatus}
          onblur={checkEmailAvailability}
          oninput={resetEmailStatus}
        />

        <!-- Phone with country selector -->
        <FormPhoneInput
          {form}
          field="phone"
          label={PHONE.label}
          countries={data.countries}
          defaultCountry="US"
          description={PHONE.description}
        />

        <!-- Country combobox -->
        <FormCombobox
          {form}
          field="country"
          {...COUNTRY}
          options={data.countries}
          onValueChange={handleCountryChange}
        />

        <!-- State/Province — conditionally shown -->
        {#if showState}
          <FormCombobox
            {form}
            field="state"
            {...STATE}
            options={stateOptions}
          />
        {/if}

        <!-- Street address with expandable extra lines -->
        <FormInput {form} field="street1" {...STREET1}>
          {#snippet labelRight()}
            <button
              type="button"
              onclick={toggleExtraLines}
              class="text-sm text-muted-foreground hover:text-foreground"
            >
              {showExtraLines ? "- Fewer address lines" : "+ More address lines"}
            </button>
          {/snippet}
        </FormInput>
        {#if showExtraLines}
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
    {data.countries.length} countries loaded (live geo reference data)
  </p>
</div>
