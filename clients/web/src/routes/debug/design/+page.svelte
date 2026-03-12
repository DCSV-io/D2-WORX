<script lang="ts">
  import ThemeToggle from "$lib/client/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/client/components/theme-selector.svelte";
  import ThemeEditor from "$lib/client/components/design/theme-editor.svelte";
  import ColorPalette from "$lib/client/components/design/color-palette.svelte";
  import TypographyShowcase from "$lib/client/components/design/typography-showcase.svelte";
  import ButtonShowcase from "$lib/client/components/design/button-showcase.svelte";
  import CardShowcase from "$lib/client/components/design/card-showcase.svelte";
  import FormShowcase from "$lib/client/components/design/form-showcase.svelte";
  import OverlayShowcase from "$lib/client/components/design/overlay-showcase.svelte";
  import NavigationShowcase from "$lib/client/components/design/navigation-showcase.svelte";
  import FeedbackShowcase from "$lib/client/components/design/feedback-showcase.svelte";
  import DataDisplayShowcase from "$lib/client/components/design/data-display-showcase.svelte";
  import ChartShowcase from "$lib/client/components/design/chart-showcase.svelte";
  import LayoutShowcase from "$lib/client/components/design/layout-showcase.svelte";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/client/components/ui/button/index.js";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import * as m from "$lib/paraglide/messages.js";

  let editorOpen = $state(false);

  const sections = [
    { id: "colors", label: "Colors" },
    { id: "typography", label: "Typography" },
    { id: "buttons", label: "Buttons" },
    { id: "cards", label: "Cards" },
    { id: "forms", label: "Forms" },
    { id: "overlays", label: "Overlays" },
    { id: "navigation", label: "Navigation" },
    { id: "feedback", label: "Feedback" },
    { id: "data-display", label: "Data Display" },
    { id: "charts", label: "Charts" },
    { id: "layout", label: "Layout & Patterns" },
  ] as const;

  const demos = [
    {
      href: "/debug/design/contact-form",
      label: "Contact Form",
      description: "Superforms + geo data, phone formatting, cascading selects",
    },
    {
      href: "/debug/design/signup-form",
      label: "Signup Form",
      description: "Password rules, email/password confirmation, show/hide toggle",
    },
  ] as const;
</script>

<svelte:head>
  <title>{m.common_ui_design_system()} — {m.webclient_nav_brand()}</title>
  <meta
    name="description"
    content={m.webclient_design_description()}
  />
  <meta
    name="robots"
    content="noindex, nofollow"
  />
  <meta
    property="og:title"
    content="{m.common_ui_design_system()} — {m.webclient_nav_brand()}"
  />
  <meta
    property="og:description"
    content={m.webclient_design_description()}
  />
  <meta
    property="og:type"
    content="website"
  />
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Design System</h1>
      <p class="text-muted-foreground mt-1">
        Kitchen sink — preview all components with live theme editing.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <ThemeSelector />
      <ThemeToggle />
      <Button
        variant="outline"
        onclick={() => (editorOpen = true)}
      >
        <PaletteIcon class="size-4" />
        Theme Editor
      </Button>
    </div>
  </div>

  <!-- Section nav -->
  <nav
    class="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 -mx-4 mb-8 overflow-x-auto border-b px-4 py-3 backdrop-blur"
  >
    <div class="flex gap-2">
      {#each sections as s (s.id)}
        <a
          href="#{s.id}"
          class="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {s.label}
        </a>
      {/each}
    </div>
  </nav>

  <!-- Demo pages -->
  {#if demos.length > 0}
    <div class="mb-8 flex flex-wrap gap-3">
      {#each demos as demo (demo.href)}
        <a
          href={resolve(demo.href)}
          class="group hover:border-primary hover:bg-accent rounded-lg border p-4 transition-colors"
        >
          <span class="group-hover:text-primary font-medium">{demo.label}</span>
          <p class="text-muted-foreground mt-1 text-xs">{demo.description}</p>
        </a>
      {/each}
    </div>
  {/if}

  <!-- Showcase sections -->
  <div class="flex flex-col gap-16">
    <ColorPalette />
    <TypographyShowcase />
    <ButtonShowcase />
    <CardShowcase />
    <FormShowcase />
    <OverlayShowcase />
    <NavigationShowcase />
    <FeedbackShowcase />
    <DataDisplayShowcase />
    <ChartShowcase />
    <LayoutShowcase />
  </div>
</div>

<ThemeEditor bind:open={editorOpen} />
