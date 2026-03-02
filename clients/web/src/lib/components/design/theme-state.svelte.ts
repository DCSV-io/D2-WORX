/**
 * Shared reactive theme state using Svelte 5 runes.
 *
 * Svelte 5 module-level rules:
 * - Cannot export `$state` that is reassigned → use object, mutate properties
 * - Cannot export `$derived` at all → export getter functions instead
 *
 * See: https://svelte.dev/e/state_invalid_export
 *      https://svelte.dev/e/derived_invalid_export
 */

import {
  builtInPresets,
  presets,
  loadCustomPresets,
  type ThemePreset,
} from "./theme-presets.js";
import {
  computeLightTokens,
  computeDarkTokens,
  generateThemeCSS,
  type ThemeTokens,
} from "./theme-utils.js";

// --- Editable state (single object — mutate properties, never reassign) ---

export const theme = $state({
  primaryHue: 285.885,
  primaryChroma: 0.006,
  primaryLightness: 0.21,
  secondaryHue: 260,
  secondaryChroma: 0.03,
  secondaryLightness: 0.45,
  accentHue: 250,
  accentChroma: 0.08,
  accentLightness: 0.55,
  destructiveHue: 27.325,
  destructiveChroma: 0.245,
  destructiveLightness: 0.577,
  infoHue: 262.881,
  infoChroma: 0.245,
  infoLightness: 0.546,
  successHue: 149.214,
  successChroma: 0.194,
  successLightness: 0.627,
  warningHue: 70.08,
  warningChroma: 0.189,
  warningLightness: 0.769,
  radius: 0.625,
});

// --- Derived (module-private, exposed via getter functions) ---

const _lightTokens = $derived.by(() =>
  computeLightTokens({
    primary: {
      hue: theme.primaryHue,
      chroma: theme.primaryChroma,
      lightness: theme.primaryLightness,
    },
    secondary: {
      hue: theme.secondaryHue,
      chroma: theme.secondaryChroma,
      lightness: theme.secondaryLightness,
    },
    accent: {
      hue: theme.accentHue,
      chroma: theme.accentChroma,
      lightness: theme.accentLightness,
    },
    destructive: {
      hue: theme.destructiveHue,
      chroma: theme.destructiveChroma,
      lightness: theme.destructiveLightness,
    },
    info: {
      hue: theme.infoHue,
      chroma: theme.infoChroma,
      lightness: theme.infoLightness,
    },
    success: {
      hue: theme.successHue,
      chroma: theme.successChroma,
      lightness: theme.successLightness,
    },
    warning: {
      hue: theme.warningHue,
      chroma: theme.warningChroma,
      lightness: theme.warningLightness,
    },
    radius: theme.radius,
  }),
);

const _darkTokens = $derived.by(() =>
  computeDarkTokens({
    primary: {
      hue: theme.primaryHue,
      chroma: theme.primaryChroma,
      lightness: theme.primaryLightness,
    },
    secondary: {
      hue: theme.secondaryHue,
      chroma: theme.secondaryChroma,
      lightness: theme.secondaryLightness,
    },
    accent: {
      hue: theme.accentHue,
      chroma: theme.accentChroma,
      lightness: theme.accentLightness,
    },
    destructive: {
      hue: theme.destructiveHue,
      chroma: theme.destructiveChroma,
      lightness: theme.destructiveLightness,
    },
    info: {
      hue: theme.infoHue,
      chroma: theme.infoChroma,
      lightness: theme.infoLightness,
    },
    success: {
      hue: theme.successHue,
      chroma: theme.successChroma,
      lightness: theme.successLightness,
    },
    warning: {
      hue: theme.warningHue,
      chroma: theme.warningChroma,
      lightness: theme.warningLightness,
    },
    radius: theme.radius,
  }),
);

const _themeCSS = $derived.by(() =>
  generateThemeCSS(_lightTokens, _darkTokens, theme.radius),
);

const _activePresetName = $derived.by(() => {
  const match = presets.find(
    (p) =>
      Math.abs(p.primaryHue - theme.primaryHue) < 0.01 &&
      Math.abs(p.primaryChroma - theme.primaryChroma) < 0.001 &&
      Math.abs(p.primaryLightness - theme.primaryLightness) < 0.001 &&
      Math.abs(p.secondaryHue - theme.secondaryHue) < 0.01 &&
      Math.abs(p.secondaryChroma - theme.secondaryChroma) < 0.001 &&
      Math.abs(p.accentHue - theme.accentHue) < 0.01 &&
      Math.abs(p.accentChroma - theme.accentChroma) < 0.001 &&
      Math.abs(p.destructiveHue - theme.destructiveHue) < 0.01 &&
      Math.abs(p.radius - theme.radius) < 0.001,
  );
  return match?.name ?? null;
});

// --- Exported getters (reactive when called inside $derived / $effect / template) ---

export function getLightTokens(): ThemeTokens {
  return _lightTokens;
}

export function getDarkTokens(): ThemeTokens {
  return _darkTokens;
}

export function getThemeCSS(): string {
  return _themeCSS;
}

export function getActivePresetName(): string | null {
  return _activePresetName;
}

// --- Actions ---

export function applyPreset(preset: ThemePreset): void {
  theme.primaryHue = preset.primaryHue;
  theme.primaryChroma = preset.primaryChroma;
  theme.primaryLightness = preset.primaryLightness;
  theme.secondaryHue = preset.secondaryHue;
  theme.secondaryChroma = preset.secondaryChroma;
  theme.secondaryLightness = preset.secondaryLightness;
  theme.accentHue = preset.accentHue;
  theme.accentChroma = preset.accentChroma;
  theme.accentLightness = preset.accentLightness;
  theme.destructiveHue = preset.destructiveHue;
  theme.destructiveChroma = preset.destructiveChroma;
  theme.destructiveLightness = preset.destructiveLightness;
  theme.infoHue = preset.infoHue;
  theme.infoChroma = preset.infoChroma;
  theme.infoLightness = preset.infoLightness;
  theme.successHue = preset.successHue;
  theme.successChroma = preset.successChroma;
  theme.successLightness = preset.successLightness;
  theme.warningHue = preset.warningHue;
  theme.warningChroma = preset.warningChroma;
  theme.warningLightness = preset.warningLightness;
  theme.radius = preset.radius;
}

export function reset(): void {
  applyPreset(builtInPresets[0]); // Zinc
}
