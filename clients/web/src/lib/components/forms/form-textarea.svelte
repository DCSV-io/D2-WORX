<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
  import type { FormPath, SuperForm } from "sveltekit-superforms";
  import { Control } from "formsnap";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";

  type Props = {
    form: SuperForm<T>;
    field: U;
    label: string;
    placeholder?: string;
    description?: string;
    disabled?: boolean;
    rows?: number;
  };

  let {
    form,
    field,
    label,
    placeholder = "",
    description,
    disabled = false,
    rows = 3,
  }: Props = $props();
</script>

<Form.Field {form} name={field}>
  <Control>
    {#snippet children({ props })}
      <Form.Label>{label}</Form.Label>
      <Textarea {...props} {placeholder} {disabled} {rows} />
    {/snippet}
  </Control>
  {#if description}
    <Form.Description>{description}</Form.Description>
  {/if}
  <Form.FieldErrors />
</Form.Field>
