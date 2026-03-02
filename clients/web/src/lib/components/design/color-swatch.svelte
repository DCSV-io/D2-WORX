<script lang="ts">
  let { name, value }: { name: string; value: string } = $props();
</script>

<div class="flex flex-col gap-1.5">
  <div
    class="h-12 w-full rounded-md border border-border"
    style="background: {value}"
  ></div>
  <div class="flex flex-col">
    <span class="text-xs font-medium">{name}</span>
    <span class="text-muted-foreground text-[10px] font-mono">{value}</span>
  </div>
</div>
