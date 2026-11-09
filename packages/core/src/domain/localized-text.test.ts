import { describe, expect, it } from 'vitest';
import { localize } from './localized-text';

describe('localize', () => {
  const text = { en: 'Chest', fr: 'Coffre', 'pt-BR': 'Baú' };

  it('returns plain strings unchanged, whatever the language', () => {
    expect(localize('Chest', 'fr', 'en')).toBe('Chest');
  });

  it('uses the requested language when present', () => {
    expect(localize(text, 'fr', 'en')).toBe('Coffre');
    expect(localize(text, 'pt-BR', 'en')).toBe('Baú');
  });

  it('falls back to the base language of a regional tag', () => {
    expect(localize(text, 'fr-CA', 'en')).toBe('Coffre');
  });

  it('falls back to the default language', () => {
    expect(localize(text, 'de', 'en')).toBe('Chest');
  });

  it('falls back to any available language when the default is missing', () => {
    expect(localize({ es: 'Cofre' }, 'de', 'en')).toBe('Cofre');
  });

  it('returns an empty string for undefined', () => {
    expect(localize(undefined, 'en', 'en')).toBe('');
  });
});
