<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { Control } from "formsnap";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  type Props = {
    form: SuperForm<T>;
    field: U;
    label: string;
    placeholder?: string;
    type?: string;
    description?: string;
    disabled?: boolean;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
  };

  let {
    form,
    field,
    label,
    placeholder = "",
    type = "text",
    description,
    disabled = false,
    oninput,
  }: Props = $props();

  const formData = form.form;
  let value = $derived(($formData as Record<string, string>)[field as string] ?? "");

  function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
    ($formData as Record<string, string>)[field as string] = e.currentTarget.value;
    oninput?.(e);
  }
</script>

<Form.Field {form} name={field}>
  <Control>
    {#snippet children({ props })}
      <Form.Label>{label}</Form.Label>
      <Input {...props} {type} {placeholder} {disabled} {value} oninput={handleInput} />
    {/snippet}
  </Control>
  {#if description}
    <Form.Description>{description}</Form.Description>
  {/if}
  <Form.FieldErrors />
</Form.Field>
