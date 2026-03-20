<script lang="ts">
  import { SidebarTrigger } from "$lib/client/components/ui/sidebar/index.js";
  import { Separator } from "$lib/client/components/ui/separator/index.js";
  import * as Breadcrumb from "$lib/client/components/ui/breadcrumb/index.js";
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
  import * as m from "$lib/paraglide/messages.js";
</script>

<header class="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
  <div class="flex items-center gap-2">
    <SidebarTrigger class="-ml-1" />
    <Separator
      orientation="vertical"
      class="mr-2 h-4"
    />
    <Breadcrumb.Breadcrumb>
      <Breadcrumb.BreadcrumbList>
        <Breadcrumb.BreadcrumbItem>
          <Breadcrumb.BreadcrumbPage>{m.common_ui_dashboard()}</Breadcrumb.BreadcrumbPage>
        </Breadcrumb.BreadcrumbItem>
      </Breadcrumb.BreadcrumbList>
    </Breadcrumb.Breadcrumb>
  </div>

  <div class="ml-auto flex items-center gap-2">
    <ThemeToggle />
    <ThemeSelector />
  </div>
</header>
