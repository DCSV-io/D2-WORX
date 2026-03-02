<script lang="ts">
  import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
  } from "$lib/components/ui/sheet/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import {
    presets,
    presetSwatchColor,
    loadCustomPresets,
    saveCustomPreset,
    deleteCustomPreset,
  } from "./theme-presets.js";
  import {
    theme,
    getActivePresetName,
    applyPreset,
    reset,
  } from "./theme-state.svelte.js";
  import ExportDialog from "./export-dialog.svelte";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let exportOpen = $state(false);
  let saveName = $state("");
  let showSaveInput = $state(false);
  let allPresets = $state(presets);

  onMount(() => {
    loadCustomPresets();
    allPresets = presets;
  });

  function handleSavePreset() {
    const name = saveName.trim();
    if (!name) return;
    allPresets = saveCustomPreset({
      name,
      primaryHue: theme.primaryHue,
      primaryChroma: theme.primaryChroma,
      primaryLightness: theme.primaryLightness,
      destructiveHue: theme.destructiveHue,
      destructiveChroma: theme.destructiveChroma,
      destructiveLightness: theme.destructiveLightness,
      infoHue: theme.infoHue,
      infoChroma: theme.infoChroma,
      infoLightness: theme.infoLightness,
      successHue: theme.successHue,
      successChroma: theme.successChroma,
      successLightness: theme.successLightness,
      warningHue: theme.warningHue,
      warningChroma: theme.warningChroma,
      warningLightness: theme.warningLightness,
      radius: theme.radius,
    });
    saveName = "";
    showSaveInput = false;
  }

  function handleDeletePreset(name: string) {
    allPresets = deleteCustomPreset(name);
  }
</script>

<Sheet bind:open>
  <SheetContent side="right" class="w-80 overflow-y-auto sm:max-w-80">
    <SheetHeader>
      <SheetTitle>Theme Editor</SheetTitle>
      <SheetDescription>Adjust colors, radius, and presets. Changes are live.</SheetDescription>
    </SheetHeader>

    <div class="flex flex-col gap-6 px-1 pt-2">
      <!-- Presets -->
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium">Presets</span>
        <div class="flex flex-wrap gap-2">
          {#each allPresets as preset (preset.name)}
            <div class="group relative">
              <button
                class="size-8 rounded-full border-2 transition-all {getActivePresetName() === preset.name ? 'border-ring ring-ring/30 ring-2 scale-110' : 'border-border hover:scale-105'}"
                style="background: {presetSwatchColor(preset)}"
                title={preset.name}
                onclick={() => applyPreset(preset)}
              >
                <span class="sr-only">{preset.name}</span>
              </button>
              {#if !preset.builtIn}
                <button
                  class="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                  title="Delete {preset.name}"
                  onclick={() => handleDeletePreset(preset.name)}
                >
                  <Trash2Icon class="size-2.5" />
                </button>
              {/if}
            </div>
          {/each}
        </div>
        <div class="flex flex-col gap-1">
          {#if !showSaveInput}
            <Button
              variant="ghost"
              size="sm"
              class="w-fit text-xs"
              onclick={() => (showSaveInput = true)}
            >
              <SaveIcon class="size-3" />
              Save Current as Preset
            </Button>
          {:else}
            <div class="flex gap-1">
              <Input
                bind:value={saveName}
                placeholder="Preset name"
                class="h-7 text-xs"
                onkeydown={(e: KeyboardEvent) => e.key === "Enter" && handleSavePreset()}
              />
              <Button size="sm" class="h-7 text-xs" onclick={handleSavePreset}>Save</Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs"
                onclick={() => (showSaveInput = false)}
              >
                Cancel
              </Button>
            </div>
          {/if}
        </div>
      </div>

      <Separator />

      <!-- Primary Color -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Primary Color</span>
          <div
            class="size-6 rounded border border-border"
            style="background: oklch({theme.primaryLightness} {theme.primaryChroma} {theme.primaryHue})"
          ></div>
        </div>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Hue</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.primaryHue.toFixed(1)}</span>
          </div>
          <Slider type="single" bind:value={theme.primaryHue} min={0} max={360} step={0.1} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Chroma</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.primaryChroma.toFixed(4)}</span>
          </div>
          <Slider type="single" bind:value={theme.primaryChroma} min={0} max={0.4} step={0.001} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Lightness</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.primaryLightness.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.primaryLightness} min={0.05} max={0.95} step={0.001} />
        </label>
      </div>

      <Separator />

      <!-- Destructive (Danger) -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Destructive</span>
          <div
            class="size-6 rounded border border-border"
            style="background: oklch({theme.destructiveLightness} {theme.destructiveChroma} {theme.destructiveHue})"
          ></div>
        </div>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Hue</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.destructiveHue.toFixed(1)}</span>
          </div>
          <Slider type="single" bind:value={theme.destructiveHue} min={0} max={360} step={0.1} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Chroma</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.destructiveChroma.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.destructiveChroma} min={0} max={0.4} step={0.001} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Lightness</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.destructiveLightness.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.destructiveLightness} min={0.2} max={0.85} step={0.001} />
        </label>
      </div>

      <Separator />

      <!-- Info -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Info</span>
          <div
            class="size-6 rounded border border-border"
            style="background: oklch({theme.infoLightness} {theme.infoChroma} {theme.infoHue})"
          ></div>
        </div>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Hue</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.infoHue.toFixed(1)}</span>
          </div>
          <Slider type="single" bind:value={theme.infoHue} min={0} max={360} step={0.1} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Chroma</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.infoChroma.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.infoChroma} min={0} max={0.4} step={0.001} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Lightness</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.infoLightness.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.infoLightness} min={0.2} max={0.85} step={0.001} />
        </label>
      </div>

      <Separator />

      <!-- Success -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Success</span>
          <div
            class="size-6 rounded border border-border"
            style="background: oklch({theme.successLightness} {theme.successChroma} {theme.successHue})"
          ></div>
        </div>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Hue</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.successHue.toFixed(1)}</span>
          </div>
          <Slider type="single" bind:value={theme.successHue} min={0} max={360} step={0.1} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Chroma</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.successChroma.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.successChroma} min={0} max={0.4} step={0.001} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Lightness</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.successLightness.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.successLightness} min={0.2} max={0.85} step={0.001} />
        </label>
      </div>

      <Separator />

      <!-- Warning -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Warning</span>
          <div
            class="size-6 rounded border border-border"
            style="background: oklch({theme.warningLightness} {theme.warningChroma} {theme.warningHue})"
          ></div>
        </div>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Hue</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.warningHue.toFixed(1)}</span>
          </div>
          <Slider type="single" bind:value={theme.warningHue} min={0} max={360} step={0.1} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Chroma</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.warningChroma.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.warningChroma} min={0} max={0.4} step={0.001} />
        </label>

        <label class="flex flex-col gap-1.5">
          <div class="flex justify-between">
            <span class="text-muted-foreground text-xs">Lightness</span>
            <span class="text-muted-foreground text-xs tabular-nums">{theme.warningLightness.toFixed(3)}</span>
          </div>
          <Slider type="single" bind:value={theme.warningLightness} min={0.2} max={0.85} step={0.001} />
        </label>
      </div>

      <Separator />

      <!-- Radius -->
      <label class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Border Radius</span>
          <div
            class="size-6 border border-border bg-primary"
            style="border-radius: {theme.radius}rem"
          ></div>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground text-xs">Radius</span>
          <span class="text-muted-foreground text-xs tabular-nums">{theme.radius.toFixed(3)}rem</span>
        </div>
        <Slider type="single" bind:value={theme.radius} min={0} max={1} step={0.025} />
      </label>

      <Separator />

      <!-- Actions -->
      <div class="flex flex-col gap-2">
        <Button onclick={() => (exportOpen = true)} class="w-full">
          <DownloadIcon class="size-4" />
          Copy Theme CSS
        </Button>
        <Button variant="outline" onclick={reset} class="w-full">
          <RotateCcwIcon class="size-4" />
          Reset to Zinc
        </Button>
      </div>
    </div>
  </SheetContent>
</Sheet>

<ExportDialog bind:open={exportOpen} />
