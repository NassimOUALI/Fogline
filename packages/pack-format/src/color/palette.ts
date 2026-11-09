import type { Palette, PaletteToken, ResolvedPalette } from '../schemas/palette';
import { contrastRatio, hslToRgb, parseHex, rgbToHsl, toHex } from './contrast';

/** Used when a pack supplies no palette, and to fill tokens a pack leaves out. */
export const DEFAULT_PALETTE: ResolvedPalette = {
  accent: '#4f8cff',
  background: '#121417',
  surface: '#1c2026',
  text: '#e8eaed',
  mapBackdrop: '#0b0d10',
};

/** WCAG AA for body text. */
export const CONTRAST_TEXT_MIN = 4.5;
/** WCAG AA for large text and UI components. */
export const CONTRAST_ACCENT_MIN = 3;

export interface ContrastRule {
  /** Token that is adjusted when the rule fails. */
  token: PaletteToken;
  /** Token it is drawn on. */
  against: PaletteToken;
  minimum: number;
}

export const CONTRAST_RULES: readonly ContrastRule[] = [
  { token: 'text', against: 'background', minimum: CONTRAST_TEXT_MIN },
  { token: 'text', against: 'surface', minimum: CONTRAST_TEXT_MIN },
  { token: 'accent', against: 'surface', minimum: CONTRAST_ACCENT_MIN },
];

export interface PaletteAdjustment {
  token: PaletteToken;
  from: string;
  to: string;
  /** The rule(s) that failed, for the message. */
  against: PaletteToken[];
  minimum: number;
  /** Worst ratio before the change. */
  actual: number;
  /**
   * `lightness`: nudged toward compliance.
   * `default`: no lightness worked, so this token and the tokens it is checked against were
   * all reset to the default palette, which is known to comply.
   */
  method: 'lightness' | 'default';
}

export interface NormalizedPalette {
  palette: ResolvedPalette;
  adjustments: PaletteAdjustment[];
}

/** Fills missing tokens from `defaults`. Pure merge, no contrast correction. */
export function resolvePalette(
  palette: Palette | undefined,
  defaults: ResolvedPalette = DEFAULT_PALETTE,
): ResolvedPalette {
  const resolved: ResolvedPalette = { ...defaults };
  if (palette === undefined) {
    return resolved;
  }
  for (const token of Object.keys(defaults) as PaletteToken[]) {
    const value = palette[token];
    if (value !== undefined) {
      resolved[token] = value.toLowerCase();
    }
  }
  return resolved;
}

interface Constraint {
  background: string;
  minimum: number;
}

function satisfies(color: string, constraints: readonly Constraint[]): boolean {
  return constraints.every((c) => contrastRatio(color, c.background) >= c.minimum);
}

/**
 * Finds the color closest in lightness to `color` (same hue and saturation) that meets every
 * constraint. Returns `undefined` when no lightness works.
 */
export function adjustLightnessForContrast(
  color: string,
  constraints: readonly Constraint[],
): string | undefined {
  if (satisfies(color, constraints)) {
    return color;
  }
  const hsl = rgbToHsl(parseHex(color));
  const steps = 100;
  let best: { hex: string; distance: number } | undefined;
  for (let i = 0; i <= steps; i += 1) {
    const l = i / steps;
    const candidate = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }));
    if (!satisfies(candidate, constraints)) {
      continue;
    }
    const distance = Math.abs(l - hsl.l);
    if (best === undefined || distance < best.distance) {
      best = { hex: candidate, distance };
    }
  }
  return best?.hex;
}

/**
 * Applies defaults, then enforces the contrast rules. Shared by the app theme applier and
 * `fogline-pack validate`, so both report and fix the same things.
 */
export function normalizePalette(
  palette: Palette | undefined,
  defaults: ResolvedPalette = DEFAULT_PALETTE,
): NormalizedPalette {
  const resolved = resolvePalette(palette, defaults);
  const adjustments: PaletteAdjustment[] = [];

  const tokens = [...new Set(CONTRAST_RULES.map((rule) => rule.token))];
  for (const token of tokens) {
    const rules = CONTRAST_RULES.filter((rule) => rule.token === token);
    const constraints = rules.map((rule) => ({
      background: resolved[rule.against],
      minimum: rule.minimum,
    }));
    const failing = rules.filter(
      (rule) => contrastRatio(resolved[token], resolved[rule.against]) < rule.minimum,
    );
    if (failing.length === 0) {
      continue;
    }
    const actual = Math.min(
      ...failing.map((rule) => contrastRatio(resolved[token], resolved[rule.against])),
    );
    const minimum = Math.max(...failing.map((rule) => rule.minimum));
    const against = failing.map((rule) => rule.against);
    const from = resolved[token];

    const nudged = adjustLightnessForContrast(from, constraints);
    if (nudged !== undefined) {
      resolved[token] = nudged;
      adjustments.push({ token, from, to: nudged, against, minimum, actual, method: 'lightness' });
      continue;
    }
    // No lightness satisfies every rule (for example a light background with a dark surface).
    // Reset the whole conflicting group to the defaults, which are known to comply.
    for (const reset of [token, ...against]) {
      if (resolved[reset] === defaults[reset]) {
        continue;
      }
      adjustments.push({
        token: reset,
        from: resolved[reset],
        to: defaults[reset],
        against,
        minimum,
        actual,
        method: 'default',
      });
      resolved[reset] = defaults[reset];
    }
  }

  return { palette: resolved, adjustments };
}
