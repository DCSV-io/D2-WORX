<script lang="ts">
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import ThemeSelector from "$lib/components/theme-selector.svelte";
  import ThemeEditor from "$lib/components/design/theme-editor.svelte";
  import ColorPalette from "$lib/components/design/color-palette.svelte";
  import TypographyShowcase from "$lib/components/design/typography-showcase.svelte";
  import ButtonShowcase from "$lib/components/design/button-showcase.svelte";
  import CardShowcase from "$lib/components/design/card-showcase.svelte";
  import FormShowcase from "$lib/components/design/form-showcase.svelte";
  import OverlayShowcase from "$lib/components/design/overlay-showcase.svelte";
  import NavigationShowcase from "$lib/components/design/navigation-showcase.svelte";
  import FeedbackShowcase from "$lib/components/design/feedback-showcase.svelte";
  import DataDisplayShowcase from "$lib/components/design/data-display-showcase.svelte";
  import LayoutShowcase from "$lib/components/design/layout-showcase.svelte";
  import {
    theme,
    getLightTokens,
    getDarkTokens,
  } from "$lib/components/design/theme-state.svelte.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import PaletteIcon from "@lucide/svelte/icons/palette";

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
    { id: "layout", label: "Layout & Patterns" },
  ] as const;

  // Build CSS overrides for live theme editing.
  // Targets the intermediate CSS variables (--background, --foreground, etc.)
  // which Tailwind utilities reference via var() in @theme inline.
  // Uses html.dark (specificity 0,1,1) to beat :root (0,1,0) for dark tokens.
  const overrideCss = $derived.by(() => {
    const light = getLightTokens();
    const dark = getDarkTokens();

    const lightLines = Object.entries(light)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    const darkLines = Object.entries(dark)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");

    return [
      `:root {`,
      `  --radius: ${theme.radius}rem;`,
      lightLines,
      `}`,
      `html.dark {`,
      darkLines,
      `}`,
    ].join("\n");
  });
</script>

<svelte:head>
  <title>Design System — D2-WORX</title>
  {@html `<style data-design-theme>${overrideCss}</style>`}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Design System</h1>
      <p class="mt-1 text-muted-foreground">
        Kitchen sink — preview all components with live theme editing.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <ThemeSelector />
      <ThemeToggle />
      <Button variant="outline" onclick={() => (editorOpen = true)}>
        <PaletteIcon class="size-4" />
        Theme Editor
      </Button>
    </div>
  </div>

  <!-- Section nav -->
  <nav class="sticky top-0 z-10 -mx-4 mb-8 overflow-x-auto border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="flex gap-2">
      {#each sections as s (s.id)}
        <a
          href="#{s.id}"
          class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {s.label}
        </a>
      {/each}
    </div>
  </nav>

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
    <LayoutShowcase />
  </div>
</div>

<ThemeEditor bind:open={editorOpen} />
