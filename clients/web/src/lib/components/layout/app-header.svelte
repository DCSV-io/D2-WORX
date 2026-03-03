<script lang="ts">
  import { SidebarTrigger } from "$lib/components/ui/sidebar/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/components/theme-selector.svelte";
</script>

<header
  class="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4"
>
  <div class="flex items-center gap-2">
    <SidebarTrigger class="-ml-1" />
    <Separator orientation="vertical" class="mr-2 h-4" />
    <Breadcrumb.Breadcrumb>
      <Breadcrumb.BreadcrumbList>
        <Breadcrumb.BreadcrumbItem>
          <Breadcrumb.BreadcrumbPage>Dashboard</Breadcrumb.BreadcrumbPage>
        </Breadcrumb.BreadcrumbItem>
      </Breadcrumb.BreadcrumbList>
    </Breadcrumb.Breadcrumb>
  </div>

  <div class="ml-auto flex items-center gap-2">
    <ThemeToggle />
    <ThemeSelector />
  </div>
</header>
