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

  const { enhance, form: formData } = form;

  // Cascading state logic: when country changes, clear state and compute available subdivisions
  let stateOptions = $state<SubdivisionOption[]>([]);
  let showState = $derived(stateOptions.length > 0);

  function handleCountryChange(countryCode: string) {
    // Clear state field
    ($formData as Record<string, string>).state = "";
    // Update available subdivisions
    stateOptions = countryCode
      ? (data.subdivisionsByCountry[countryCode] ?? [])
      : [];
  }

  // Initialize state options from current form value (e.g. after validation error)
  $effect(() => {
    const country = ($formData as Record<string, string>).country;
    if (country) {
      stateOptions = data.subdivisionsByCountry[country] ?? [];
    }
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
        (Memory → Redis → Disk → gRPC).
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <form method="POST" use:enhance class="flex flex-col gap-5">
        <!-- Name row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="firstName" label="First Name" placeholder="Jane" />
          <FormInput {form} field="lastName" label="Last Name" placeholder="Doe" />
        </div>

        <!-- Email -->
        <FormInput {form} field="email" label="Email" type="email" placeholder="jane@example.com" />

        <!-- Phone with country selector -->
        <FormPhoneInput
          {form}
          field="phone"
          label="Phone"
          countries={data.countries}
          defaultCountry="US"
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

        <!-- Street address -->
        <FormInput {form} field="street1" label="Street Address" placeholder="123 Main St" />
        <FormInput
          {form}
          field="street2"
          label="Street Address Line 2"
          placeholder="Apt, suite, etc. (optional)"
        />

        <!-- City + Postal Code row -->
        <div class="grid gap-4 sm:grid-cols-2">
          <FormInput {form} field="city" label="City" placeholder="San Francisco" />
          <FormInput {form} field="postalCode" label="Postal Code" placeholder="94102" />
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
