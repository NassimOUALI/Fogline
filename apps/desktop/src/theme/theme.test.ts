// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio, DEFAULT_PALETTE } from '@fogline/pack-format';
import {
  applyTheme,
  buildTheme,
  mix,
  readableOn,
  THEME_TRANSITION_CLASS,
  THEME_VARIABLES,
} from './theme';

const examplePalette = {
  accent: '#c98a3c',
  background: '#1b1712',
  surface: '#261f18',
  text: '#efe6d8',
  mapBackdrop: '#0f0c09',
};

describe('buildTheme', () => {
  it('uses the app default without a pack palette', () => {
    const { tokens, adjustments } = buildTheme();
    expect(adjustments).toEqual([]);
    expect(tokens['--fl-accent']).toBe(DEFAULT_PALETTE.accent);
    expect(tokens['--fl-background']).toBe(DEFAULT_PALETTE.background);
  });

  it('takes pack tokens and derives every other variable', () => {
    const { tokens } = buildTheme(examplePalette);
    expect(Object.keys(tokens).sort()).toEqual([...THEME_VARIABLES].sort());
    expect(tokens['--fl-accent']).toBe('#c98a3c');
    expect(tokens['--fl-map-backdrop']).toBe('#0f0c09');
    expect(tokens['--fl-surface-hover']).not.toBe(tokens['--fl-surface']);
  });

  it('keeps derived text readable', () => {
    for (const palette of [
      undefined,
      examplePalette,
      { accent: '#2266cc', background: '#ffffff', surface: '#f2f2f2', text: '#111111' },
    ]) {
      const { tokens } = buildTheme(palette);
      expect(contrastRatio(tokens['--fl-muted'], tokens['--fl-surface'])).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(tokens['--fl-muted'], tokens['--fl-background'])).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(tokens['--fl-on-accent'], tokens['--fl-accent'])).toBeGreaterThanOrEqual(
        3,
      );
      expect(contrastRatio(tokens['--fl-danger'], tokens['--fl-surface'])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('applies the shared contrast fallback to a failing pack palette', () => {
    const { tokens, adjustments } = buildTheme({ ...examplePalette, text: '#3a3026' });
    expect(adjustments.map((a) => a.token)).toEqual(['text']);
    expect(contrastRatio(tokens['--fl-text'], tokens['--fl-surface'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('color helpers', () => {
  it('mixes colors and picks readable foregrounds', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#123456', '#abcdef', 0)).toBe('#123456');
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#101820')).toBe('#ffffff');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes every token as a CSS variable on the root', () => {
    const root = document.createElement('div');
    applyTheme(root, examplePalette);
    expect(root.style.getPropertyValue('--fl-accent')).toBe('#c98a3c');
    for (const name of THEME_VARIABLES) {
      expect(root.style.getPropertyValue(name)).not.toBe('');
    }
  });

  it('cross-fades briefly when animating', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    applyTheme(root, examplePalette, { animate: true });
    expect(root.classList.contains(THEME_TRANSITION_CLASS)).toBe(true);
    vi.advanceTimersByTime(300);
    expect(root.classList.contains(THEME_TRANSITION_CLASS)).toBe(false);
  });

  it('does not animate when the user prefers reduced motion', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('matchMedia', matchMedia);
    const root = document.createElement('div');
    applyTheme(root, examplePalette, { animate: true });
    expect(root.classList.contains(THEME_TRANSITION_CLASS)).toBe(false);
    vi.unstubAllGlobals();
  });
});
