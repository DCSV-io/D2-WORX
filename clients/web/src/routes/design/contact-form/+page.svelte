<script lang="ts">
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { contactSchema } from "./schema.js";
  import { FormInput } from "$lib/components/forms/index.js";
  import FormCombobox from "$lib/components/forms/form-combobox.svelte";
  import FormPhoneInput from "$lib/components/forms/form-phone-input.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { toast } from "svelte-sonner";
  import type { SubdivisionOption } from "$lib/forms/geo-ref-data.js";
  import type { FieldStatus } from "$lib/forms/field-status.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";

  let { data } = $props();

  const form = superForm(data.form, {
    id: "contact-form",
    validators: zodClient(contactSchema),
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
      <form method="POST" use:enhance class="flex flex-col gap-5">
        <!-- Name row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="firstName" label="First Name" placeholder="First" />
          <FormInput {form} field="lastName" label="Last Name" placeholder="Last" />
        </div>

        <!-- Email with async availability check -->
        <FormInput
          {form}
          field="email"
          label="Email"
          type="email"
          placeholder="your@email.com"
          description="We'll never share your email."
          status={emailStatus === "idle" ? undefined : emailStatus}
          onblur={checkEmailAvailability}
          oninput={resetEmailStatus}
        />

        <!-- Phone with country selector -->
        <FormPhoneInput
          {form}
          field="phone"
          label="Phone"
          countries={data.countries}
          defaultCountry="US"
          description="Include country code for international numbers."
        />

        <!-- Country combobox -->
        <FormCombobox
          {form}
          field="country"
          label="Country"
          options={data.countries}
          placeholder="Select a country..."
          searchPlaceholder="Search countries..."
          emptyMessage="No country found."
          onValueChange={handleCountryChange}
        />

        <!-- State/Province — conditionally shown -->
        {#if showState}
          <FormCombobox
            {form}
            field="state"
            label="State / Province"
            options={stateOptions}
            placeholder="Select a state..."
            searchPlaceholder="Search states..."
            emptyMessage="No state found."
          />
        {/if}

        <!-- Street address with expandable extra lines -->
        <FormInput {form} field="street1" label="Street Address" placeholder="123 Street Rd">
          {#snippet labelRight()}
            <button
              type="button"
              onclick={toggleExtraLines}
              class="text-xs text-muted-foreground hover:text-foreground"
            >
              {showExtraLines ? "- Fewer address lines" : "+ More address lines"}
            </button>
          {/snippet}
        </FormInput>
        {#if showExtraLines}
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput
              {form}
              field="street2"
              label="Address Line 2"
              placeholder="Apt, suite, unit"
            />
            <FormInput
              {form}
              field="street3"
              label="Address Line 3"
              placeholder="Building, floor"
            />
          </div>
        {/if}

        <!-- City + Postal Code row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="city" label="City" placeholder="City" />
          <FormInput
            {form}
            field="postalCode"
            label="Postal Code"
            placeholder="#####"
            description="Must match the selected country format."
          />
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
