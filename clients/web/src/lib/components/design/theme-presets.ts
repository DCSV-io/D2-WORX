export interface ThemePreset {
  name: string;
  primaryHue: number;
  primaryChroma: number;
  primaryLightness: number;
  destructiveHue: number;
  destructiveChroma: number;
  destructiveLightness: number;
  infoHue: number;
  infoChroma: number;
  infoLightness: number;
  successHue: number;
  successChroma: number;
  successLightness: number;
  warningHue: number;
  warningChroma: number;
  warningLightness: number;
  radius: number;
  builtIn?: boolean;
}

/** Shared defaults for status colors across all presets. */
const STATUS_DEFAULTS = {
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
} as const;

/**
 * Built-in presets — professional palettes suitable for SaaS applications.
 * Each is calibrated for good contrast and readability in both light and dark.
 */
export const builtInPresets: ThemePreset[] = [
  {
    name: "Zinc",
    primaryHue: 285.885,
    primaryChroma: 0.006,
    primaryLightness: 0.21,
    ...STATUS_DEFAULTS,
    radius: 0.625,
    builtIn: true,
  },
  {
    name: "Slate",
    primaryHue: 264,
    primaryChroma: 0.015,
    primaryLightness: 0.208,
    ...STATUS_DEFAULTS,
    radius: 0.625,
    builtIn: true,
  },
  {
    name: "Blue",
    primaryHue: 262,
    primaryChroma: 0.14,
    primaryLightness: 0.5,
    ...STATUS_DEFAULTS,
    radius: 0.625,
    builtIn: true,
  },
  {
    name: "Green",
    primaryHue: 160,
    primaryChroma: 0.13,
    primaryLightness: 0.44,
    ...STATUS_DEFAULTS,
    radius: 0.625,
    builtIn: true,
  },
  {
    name: "Amber",
    primaryHue: 84,
    primaryChroma: 0.17,
    primaryLightness: 0.55,
    ...STATUS_DEFAULTS,
    radius: 0.625,
    builtIn: true,
  },
];

/** All presets (built-in + custom from localStorage). */
export let presets: ThemePreset[] = [...builtInPresets];

const STORAGE_KEY = "d2-design-custom-presets";

/** Load custom presets from localStorage. */
export function loadCustomPresets(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const custom: ThemePreset[] = JSON.parse(raw);
      presets = [...builtInPresets, ...custom.map((p) => ({ ...p, builtIn: false }))];
    }
  } catch {
    // Ignore corrupted data
  }
}

/** Save a new custom preset. Returns the updated presets array. */
export function saveCustomPreset(preset: Omit<ThemePreset, "builtIn">): ThemePreset[] {
  const custom = presets.filter((p) => !p.builtIn);
  // Replace if same name exists
  const idx = custom.findIndex((p) => p.name === preset.name);
  const entry = { ...preset, builtIn: false };
  if (idx >= 0) {
    custom[idx] = entry;
  } else {
    custom.push(entry);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // localStorage full or unavailable
  }
  presets = [...builtInPresets, ...custom];
  return presets;
}

/** Delete a custom preset by name. Returns the updated presets array. */
export function deleteCustomPreset(name: string): ThemePreset[] {
  const custom = presets.filter((p) => !p.builtIn && p.name !== name);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // localStorage full or unavailable
  }
  presets = [...builtInPresets, ...custom];
  return presets;
}

/** Preview swatch color for each preset (used in the selector). */
export function presetSwatchColor(preset: ThemePreset): string {
  return `oklch(${preset.primaryLightness} ${preset.primaryChroma} ${preset.primaryHue})`;
}
