<script lang="ts">
  import { SidebarProvider } from "$lib/components/ui/sidebar/index.js";
  import AppHeader from "./app-header.svelte";
</script>

<SidebarProvider open={true}>
  <AppHeader />
</SidebarProvider>
