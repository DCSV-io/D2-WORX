<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { Control } from "formsnap";
  import { cn } from "$lib/utils.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";

  type Option = { value: string; label: string; flag?: string };

  type Props = {
    form: SuperForm<T>;
    field: U;
    label: string;
    options: Option[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    description?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
  };

  let {
    form,
    field,
    label,
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
    description,
    disabled = false,
    onValueChange,
  }: Props = $props();

  let open = $state(false);

  const formData = form.form;
  let value = $derived(($formData as Record<string, string>)[field as string] ?? "");
  const selectedOption = $derived(options.find((o) => o.value === value));

  function handleSelect(optionValue: string) {
    const newValue = value === optionValue ? "" : optionValue;
    ($formData as Record<string, string>)[field as string] = newValue;
    open = false;
    onValueChange?.(newValue);
  }
</script>

<Form.Field {form} name={field}>
  <Control>
    {#snippet children({ props })}
      <Form.Label>{label}</Form.Label>
      <input type="hidden" name={props.name} {value} />
      <Popover.Root bind:open>
        <Popover.Trigger
          {disabled}
          {...props}
          class={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
        >
          {#if selectedOption?.flag}
            <span class="flex items-center gap-2 truncate">
              <img
                src={selectedOption.flag}
                alt=""
                class="h-3 w-4 shrink-0 object-cover"
              />
              {selectedOption.label}
            </span>
          {:else}
            <span class="truncate">{selectedOption?.label ?? placeholder}</span>
          {/if}
          <ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
        </Popover.Trigger>
        <Popover.Content class="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command.Root>
            <Command.Input placeholder={searchPlaceholder} />
            <Command.List>
              <Command.Empty>{emptyMessage}</Command.Empty>
              <Command.Group>
                {#each options as option (option.value)}
                  <Command.Item
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <CheckIcon
                      class="mr-2 size-4 shrink-0 {value === option.value ? 'opacity-100' : 'opacity-0'}"
                    />
                    {#if option.flag}
                      <img
                        src={option.flag}
                        alt=""
                        class="mr-2 h-3 w-4 shrink-0 object-cover"
                      />
                    {/if}
                    {option.label}
                  </Command.Item>
                {/each}
              </Command.Group>
            </Command.List>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    {/snippet}
  </Control>
  {#if description}
    <Form.Description>{description}</Form.Description>
  {/if}
  <Form.FieldErrors />
</Form.Field>
