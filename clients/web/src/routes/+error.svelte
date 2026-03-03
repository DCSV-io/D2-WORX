<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
  <h1 class="text-6xl font-bold tracking-tight">
    {page.status}
  </h1>

  <p class="mt-4 text-xl text-muted-foreground">
    {page.error?.message ?? "Something went wrong"}
  </p>

  {#if page.error?.traceId}
    <p class="mt-2 text-sm text-muted-foreground">
      Reference: <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{page.error.traceId}</code>
    </p>
  {/if}

  <div class="mt-8">
    <a
      href={resolve("/")}
      class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
    >
      Go home
    </a>
  </div>
</div>
