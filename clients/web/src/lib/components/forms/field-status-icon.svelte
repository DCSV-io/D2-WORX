<script lang="ts">
  import type { FieldStatus } from "$lib/forms/field-status.js";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";

  type Props = {
    status: FieldStatus;
  };

  let { status }: Props = $props();
</script>

{#if status === "valid"}
  <CircleCheckIcon class="size-3.5 text-success" />
{:else if status === "invalid"}
  <CircleXIcon class="size-3.5 text-destructive" />
{:else if status === "validating"}
  <LoaderCircleIcon class="size-3.5 animate-spin text-muted-foreground" />
{/if}
