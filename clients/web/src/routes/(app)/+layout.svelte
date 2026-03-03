<script lang="ts">
  import { SidebarProvider, SidebarInset } from "$lib/components/ui/sidebar/index.js";
  import AppSidebar from "$lib/components/layout/app-sidebar.svelte";
  import AppHeader from "$lib/components/layout/app-header.svelte";

  let { data, children } = $props();
</script>

<SidebarProvider>
  <AppSidebar orgType={data.orgType} role={data.role} />
  <SidebarInset>
    <AppHeader />
    <main class="flex-1 p-4 sm:p-6">
      {@render children?.()}
    </main>
  </SidebarInset>
</SidebarProvider>
