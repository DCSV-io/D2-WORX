<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { Control } from "formsnap";
  import { cn } from "$lib/utils.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import type { CountryOption } from "$lib/forms/geo-ref-data.js";
  import { formatPhoneAsYouType, getCountryCallingCode } from "$lib/forms/phone-format.js";

  type Props = {
    form: SuperForm<T>;
    field: U;
    label: string;
    countries: CountryOption[];
    defaultCountry?: string;
    description?: string;
    disabled?: boolean;
  };

  let {
    form,
    field,
    label,
    countries,
    defaultCountry = "US",
    description,
    disabled = false,
  }: Props = $props();

  let countryOpen = $state(false);
  let selectedCountryCode = $state(defaultCountry);
  /** The formatted display value the user sees. */
  let displayValue = $state("");

  const formData = form.form;
  const selectedCountry = $derived(
    countries.find((c) => c.value === selectedCountryCode),
  );
  const prefix = $derived(
    selectedCountry?.phonePrefix || getCountryCallingCode(selectedCountryCode),
  );

  function handleCountrySelect(code: string) {
    selectedCountryCode = code;
    countryOpen = false;
    // Re-format existing digits for new country + update stored E.164
    updateFormValue(displayValue);
  }

  function handlePhoneInput(e: Event & { currentTarget: HTMLInputElement }) {
    const raw = e.currentTarget.value;
    updateFormValue(raw);
  }

  function updateFormValue(raw: string) {
    if (!raw.trim()) {
      displayValue = "";
      ($formData as Record<string, string>)[field as string] = "";
      return;
    }
    const result = formatPhoneAsYouType(raw, selectedCountryCode);
    displayValue = result.formatted;
    // Store full E.164 in form data
    ($formData as Record<string, string>)[field as string] =
      result.national ? `${prefix}${result.national}` : "";
  }
</script>

<Form.Field {form} name={field}>
  <Control>
    {#snippet children({ props })}
      {@const { name: fieldName, ...triggerProps } = props}
      <Form.Label>{label}</Form.Label>
      <input type="hidden" name={fieldName} value={($formData as Record<string, string>)[field as string] ?? ""} />
      <div class="flex gap-1">
        <!-- Country prefix selector -->
        <Popover.Root bind:open={countryOpen}>
          <Popover.Trigger
            {disabled}
            class={cn(buttonVariants({ variant: "outline" }), "flex w-[100px] shrink-0 items-center gap-1 px-2")}
          >
            {#if selectedCountry}
              <img
                src={selectedCountry.flag}
                alt={selectedCountry.label}
                class="h-3 w-4 shrink-0 object-cover"
              />
            {/if}
            <span class="text-xs text-muted-foreground">{prefix}</span>
            <ChevronsUpDownIcon class="ml-auto size-3 shrink-0 opacity-50" />
          </Popover.Trigger>
          <Popover.Content class="w-[280px] p-0" align="start">
            <Command.Root>
              <Command.Input placeholder="Search country..." />
              <Command.List>
                <Command.Empty>No country found.</Command.Empty>
                <Command.Group>
                  {#each countries as country (country.value)}
                    <Command.Item
                      value={country.value}
                      keywords={[country.label, country.phonePrefix]}
                      onSelect={() => handleCountrySelect(country.value)}
                    >
                      <CheckIcon
                        class="mr-2 size-4 shrink-0 {selectedCountryCode === country.value ? 'opacity-100' : 'opacity-0'}"
                      />
                      <img
                        src={country.flag}
                        alt=""
                        class="mr-2 h-3 w-4 shrink-0 object-cover"
                      />
                      <span class="truncate">{country.label}</span>
                      <span class="ml-auto text-xs text-muted-foreground">
                        {country.phonePrefix}
                      </span>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>

        <!-- Phone number input (display only — hidden input carries the E.164 value) -->
        <Input
          {...triggerProps}
          type="tel"
          value={displayValue}
          placeholder="Phone number"
          {disabled}
          oninput={handlePhoneInput}
          class="flex-1"
        />
      </div>
    {/snippet}
  </Control>
  {#if description}
    <Form.Description>{description}</Form.Description>
  {/if}
  <Form.FieldErrors />
</Form.Field>
