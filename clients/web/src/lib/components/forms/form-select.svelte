<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { Control } from "formsnap";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

  type Option = { value: string; label: string };

  type Props = {
    form: SuperForm<T>;
    field: U;
    label: string;
    options: Option[];
    placeholder?: string;
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
    description,
    disabled = false,
    onValueChange,
  }: Props = $props();

  const formData = form.form;
  let value = $derived(($formData as Record<string, string>)[field as string] ?? "");
  const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? placeholder);

  function handleChange(newValue: string | undefined) {
    if (newValue !== undefined) {
      ($formData as Record<string, string>)[field as string] = newValue;
      onValueChange?.(newValue);
    }
  }
</script>

<Form.Field {form} name={field}>
  <Control>
    {#snippet children({ props })}
      <Form.Label>{label}</Form.Label>
      <Select.Root type="single" value={value} onValueChange={handleChange} {disabled}>
        <Select.Trigger {...props} class="w-full">
          <span class="truncate">{selectedLabel}</span>
        </Select.Trigger>
        <Select.Content>
          {#each options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    {/snippet}
  </Control>
  {#if description}
    <Form.Description>{description}</Form.Description>
  {/if}
  <Form.FieldErrors />
</Form.Field>
