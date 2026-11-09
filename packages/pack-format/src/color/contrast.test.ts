import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE76,
  hslToRgb,
  parseHex,
  relativeLuminance,
  rgbToHsl,
  toHex,
} from './contrast';

describe('hex parsing', () => {
  it('round-trips', () => {
    expect(toHex(parseHex('#c98a3c'))).toBe('#c98a3c');
    expect(parseHex('#FF0080')).toEqual({ r: 255, g: 0, b: 128 });
  });

  it('rejects short and malformed values', () => {
    expect(() => parseHex('#fff')).toThrow();
    expect(() => parseHex('c98a3c')).toThrow();
  });

  it('clamps channels when serializing', () => {
    expect(toHex({ r: 300, g: -5, b: 12.6 })).toBe('#ff000d');
  });
});

describe('WCAG contrast', () => {
  it('black on white is 21:1 and identical colors are 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('matches a known reference pair', () => {
    // #767676 on white is the classic "just passes AA" gray.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
  });

  it('luminance is 0 for black and 1 for white', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBe(0);
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 5);
  });
});

describe('HSL conversion', () => {
  it('round-trips saturated and gray colors', () => {
    for (const hex of ['#c98a3c', '#4f8cff', '#808080', '#000000', '#ffffff', '#00ff00']) {
      expect(toHex(hslToRgb(rgbToHsl(parseHex(hex))))).toBe(hex);
    }
  });

  it('reports lightness in 0..1', () => {
    expect(rgbToHsl(parseHex('#ffffff')).l).toBe(1);
    expect(rgbToHsl(parseHex('#000000')).l).toBe(0);
  });
});

describe('deltaE76', () => {
  it('is zero for identical colors and symmetric', () => {
    expect(deltaE76('#9aa3ad', '#9aa3ad')).toBe(0);
    expect(deltaE76('#9aa3ad', '#d9a441')).toBeCloseTo(deltaE76('#d9a441', '#9aa3ad'), 10);
  });

  it('separates near-identical from clearly different colors', () => {
    expect(deltaE76('#9aa3ad', '#9ba4ae')).toBeLessThan(2);
    expect(deltaE76('#9aa3ad', '#d9a441')).toBeGreaterThan(30);
    expect(deltaE76('#d9534f', '#4a9bd9')).toBeGreaterThan(50);
  });
});
