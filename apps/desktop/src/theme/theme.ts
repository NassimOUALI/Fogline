import {
  contrastRatio,
  CONTRAST_TEXT_MIN,
  normalizePalette,
  parseHex,
  toHex,
  type Palette,
  type PaletteAdjustment,
} from '@fogline/pack-format';

/**
 * Every CSS variable the UI reads. Components use the matching Tailwind tokens
 * (`bg-surface`, `text-muted`, ...) and never raw colors (docs/04).
 */
export const THEME_VARIABLES = [
  '--fl-background',
  '--fl-surface',
  '--fl-surface-hover',
  '--fl-surface-active',
  '--fl-border',
  '--fl-text',
  '--fl-muted',
  '--fl-accent',
  '--fl-accent-hover',
  '--fl-on-accent',
  '--fl-focus',
  '--fl-selection',
  '--fl-danger',
  '--fl-map-backdrop',
] as const;

export type ThemeVariable = (typeof THEME_VARIABLES)[number];
export type ThemeTokens = Record<ThemeVariable, string>;

export interface Theme {
  readonly tokens: ThemeTokens;
  /** Contrast corrections applied to the pack palette (shared with `fogline-pack validate`). */
  readonly adjustments: readonly PaletteAdjustment[];
}

/** Linear mix in sRGB: `amount` 0 gives `from`, 1 gives `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/** Black or white, whichever reads better on `color`. */
export function readableOn(color: string): string {
  return contrastRatio('#000000', color) >= contrastRatio('#ffffff', color) ? '#000000' : '#ffffff';
}

/** The softest mix of text toward the background that still meets 4.5:1 on both surfaces. */
function mutedText(text: string, background: string, surface: string): string {
  for (let amount = 0.4; amount > 0; amount -= 0.05) {
    const candidate = mix(text, background, amount);
    if (
      contrastRatio(candidate, background) >= CONTRAST_TEXT_MIN &&
      contrastRatio(candidate, surface) >= CONTRAST_TEXT_MIN
    ) {
      return candidate;
    }
  }
  return text;
}

/** The app's danger color is part of its identity; only its shade adapts for contrast. */
function dangerOn(surface: string): string {
  const shades = ['#ff6b6b', '#e5484d', '#c4161c', '#8f0b10'];
  return shades.find((shade) => contrastRatio(shade, surface) >= CONTRAST_TEXT_MIN) ?? '#8f0b10';
}

/**
 * Turns a pack palette (or none) into the full token set. Missing tokens come from the app
 * default; failing contrast is corrected by the shared pack-format helper; the rest is derived.
 */
export function buildTheme(palette?: Palette): Theme {
  const { palette: base, adjustments } = normalizePalette(palette);
  const isDark = contrastRatio(base.text, '#000000') > contrastRatio(base.text, '#ffffff');
  const lift = isDark ? 0.08 : 0.06;
  return {
    adjustments,
    tokens: {
      '--fl-background': base.background,
      '--fl-surface': base.surface,
      '--fl-surface-hover': mix(base.surface, base.text, lift),
      '--fl-surface-active': mix(base.surface, base.text, lift * 2),
      '--fl-border': mix(base.surface, base.text, 0.2),
      '--fl-text': base.text,
      '--fl-muted': mutedText(base.text, base.background, base.surface),
      '--fl-accent': base.accent,
      '--fl-accent-hover': mix(base.accent, base.text, 0.15),
      '--fl-on-accent': readableOn(base.accent),
      '--fl-focus': base.accent,
      '--fl-selection': mix(base.accent, base.background, 0.6),
      '--fl-danger': dangerOn(base.surface),
      '--fl-map-backdrop': base.mapBackdrop,
    },
  };
}

export const THEME_TRANSITION_CLASS = 'fl-theme-transition';
export const THEME_TRANSITION_MS = 250;

/**
 * The single theme applier: writes the tokens as CSS variables on `root`. With `animate`, the
 * change cross-fades briefly, unless the user prefers reduced motion.
 */
export function applyTheme(
  root: HTMLElement,
  palette: Palette | undefined,
  options: { readonly animate?: boolean } = {},
): Theme {
  const theme = buildTheme(palette);
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (options.animate === true && !reducedMotion) {
    root.classList.add(THEME_TRANSITION_CLASS);
    window.setTimeout(() => {
      root.classList.remove(THEME_TRANSITION_CLASS);
    }, THEME_TRANSITION_MS);
  }
  for (const name of THEME_VARIABLES) {
    root.style.setProperty(name, theme.tokens[name]);
  }
  return theme;
}
