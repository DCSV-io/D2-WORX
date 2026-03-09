<script lang="ts">
  import { cn } from "$lib/shared/utils/utils.js";
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  type Props = HTMLAnchorAttributes & {
    children: Snippet;
    class?: string;
  };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- callers resolve href -->
<a
  class={cn("text-primary underline-offset-2 hover:underline decoration-[0.1rem]", className)}
  {...restProps}
>
  {@render children()}
</a>
