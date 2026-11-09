import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import {
  adjustLightnessForContrast,
  CONTRAST_ACCENT_MIN,
  CONTRAST_RULES,
  CONTRAST_TEXT_MIN,
  DEFAULT_PALETTE,
  normalizePalette,
  resolvePalette,
} from './palette';

const examplePalette = {
  accent: '#c98a3c',
  background: '#1b1712',
  surface: '#261f18',
  text: '#efe6d8',
  mapBackdrop: '#0f0c09',
};

describe('DEFAULT_PALETTE', () => {
  it('passes every contrast rule', () => {
    for (const rule of CONTRAST_RULES) {
      expect(
        contrastRatio(DEFAULT_PALETTE[rule.token], DEFAULT_PALETTE[rule.against]),
      ).toBeGreaterThanOrEqual(rule.minimum);
    }
  });
});

describe('resolvePalette', () => {
  it('fills missing tokens from the defaults and lowercases supplied ones', () => {
    const resolved = resolvePalette({ accent: '#C98A3C' });
    expect(resolved).toEqual({ ...DEFAULT_PALETTE, accent: '#c98a3c' });
  });

  it('returns the defaults for no palette', () => {
    expect(resolvePalette(undefined)).toEqual(DEFAULT_PALETTE);
  });
});

describe('normalizePalette', () => {
  it('leaves a compliant palette untouched', () => {
    const { palette, adjustments } = normalizePalette(examplePalette);
    expect(adjustments).toEqual([]);
    expect(palette).toEqual(examplePalette);
  });

  it('nudges low-contrast text toward compliance and reports it', () => {
    const { palette, adjustments } = normalizePalette({ ...examplePalette, text: '#333333' });
    expect(adjustments).toHaveLength(1);
    const [adjustment] = adjustments;
    expect(adjustment?.token).toBe('text');
    expect(adjustment?.method).toBe('lightness');
    expect(adjustment?.against).toEqual(['background', 'surface']);
    expect(adjustment?.from).toBe('#333333');
    expect(adjustment?.actual).toBeLessThan(CONTRAST_TEXT_MIN);
    expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(
      CONTRAST_TEXT_MIN,
    );
    expect(contrastRatio(palette.text, palette.surface)).toBeGreaterThanOrEqual(CONTRAST_TEXT_MIN);
    // Other tokens are unchanged.
    expect(palette.accent).toBe(examplePalette.accent);
  });

  it('adjusts the accent against the surface only', () => {
    const { palette, adjustments } = normalizePalette({ ...examplePalette, accent: '#2a2219' });
    expect(adjustments.map((a) => a.token)).toEqual(['accent']);
    expect(contrastRatio(palette.accent, palette.surface)).toBeGreaterThanOrEqual(
      CONTRAST_ACCENT_MIN,
    );
  });

  it('resets the conflicting group when the pack supplies only a light background', () => {
    // Light background with the dark default surface: no text color suits both, so the
    // background is reset to the default along with the text.
    const { palette, adjustments } = normalizePalette({ accent: '#c98a3c', background: '#f5f5f5' });
    expect(adjustments.map((a) => a.token)).toEqual(['background']);
    expect(adjustments[0]?.method).toBe('default');
    expect(palette.background).toBe(DEFAULT_PALETTE.background);
    expect(palette.text).toBe(DEFAULT_PALETTE.text);
    expect(palette.accent).toBe('#c98a3c');
    expect(contrastRatio(palette.text, palette.background)).toBeGreaterThanOrEqual(
      CONTRAST_TEXT_MIN,
    );
  });

  it('falls back to the default tokens when no lightness satisfies the rules', () => {
    // Black background and near-white surface: no single text color reaches 4.5:1 on both
    // (the best achievable is about 4.3:1). Only the failing pair is reset: the text and the
    // surface. The background already passed and is kept.
    const { palette, adjustments } = normalizePalette({
      accent: '#c98a3c',
      background: '#000000',
      surface: '#f0f0f0',
      text: '#808080',
    });
    expect(adjustments.map((a) => a.token).sort()).toEqual(['surface', 'text']);
    expect(adjustments.every((a) => a.method === 'default')).toBe(true);
    expect(palette.text).toBe(DEFAULT_PALETTE.text);
    expect(palette.surface).toBe(DEFAULT_PALETTE.surface);
    expect(palette.background).toBe('#000000');
    for (const rule of CONTRAST_RULES) {
      expect(contrastRatio(palette[rule.token], palette[rule.against])).toBeGreaterThanOrEqual(
        rule.minimum,
      );
    }
  });
});

describe('adjustLightnessForContrast', () => {
  it('returns the input when it already complies', () => {
    expect(adjustLightnessForContrast('#efe6d8', [{ background: '#1b1712', minimum: 4.5 }])).toBe(
      '#efe6d8',
    );
  });

  it('keeps hue and moves lightness minimally', () => {
    const result = adjustLightnessForContrast('#8a5a1e', [{ background: '#261f18', minimum: 4.5 }]);
    expect(result).toBeDefined();
    expect(contrastRatio(result ?? '#000000', '#261f18')).toBeGreaterThanOrEqual(4.5);
  });

  it('returns undefined when impossible', () => {
    expect(
      adjustLightnessForContrast('#808080', [
        { background: '#000000', minimum: 4.5 },
        { background: '#f0f0f0', minimum: 4.5 },
      ]),
    ).toBeUndefined();
  });
});
