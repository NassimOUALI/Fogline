import { describe, expect, it } from 'vitest';
import { readExampleJson } from '../../test/fixtures';
import { categoriesFileSchema } from './categories';
import {
  hexColorSchema,
  idSchema,
  localizedTextSchema,
  resolveLocalizedText,
  semverSchema,
} from './common';
import { libraryFileSchema } from './library';
import { manifestSchema } from './manifest';
import { markersFileSchema } from './markers';
import { progressExportSchema, progressFileSchema } from './progress';

describe('example files parse with the schemas', () => {
  it('manifest', () => {
    const manifest = manifestSchema.parse(readExampleJson('pack/manifest.json'));
    expect(manifest.id).toBe('com.example.example-game');
    expect(manifest.maps.map((m) => m.tiles.type)).toEqual(['xyz', 'pmtiles']);
  });

  it('categories', () => {
    const tree = categoriesFileSchema.parse(readExampleJson('pack/data/categories.json'));
    expect(tree).toHaveLength(3);
    expect(tree[1]?.children?.[0]?.children).toHaveLength(2);
  });

  it('markers', () => {
    const overworld = markersFileSchema.parse(readExampleJson('pack/data/markers/overworld.json'));
    const caves = markersFileSchema.parse(readExampleJson('pack/data/markers/caves.json'));
    expect(overworld).toHaveLength(6);
    expect(caves).toHaveLength(3);
    expect(overworld[1]?.attributes).toHaveLength(2);
  });

  it('library', () => {
    const library = libraryFileSchema.parse(readExampleJson('app-data/library.json'));
    expect(library.entries.map((e) => e.status)).toEqual(['available', 'missing']);
  });

  it('progress', () => {
    const progress = progressFileSchema.parse(
      readExampleJson('app-data/progress/com.example.example-game.json'),
    );
    expect(Object.keys(progress.collected)).toHaveLength(2);
    expect(progress.filters.hiddenNodeIds).toEqual(['chest-common']);
    expect(progress.lastView?.map).toBe('overworld');
  });

  it('progress applies defaults for a minimal file', () => {
    const progress = progressFileSchema.parse({
      formatVersion: 1,
      packId: 'x',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(progress.collected).toEqual({});
    expect(progress.customMarkers).toEqual([]);
    expect(progress.filters).toEqual({ hiddenNodeIds: [], hideCollected: false });
  });

  it('progress export', () => {
    const exported = progressExportSchema.parse({
      formatVersion: 1,
      packId: 'x',
      packVersion: '1.0.0',
      exportedAt: '2026-01-01T00:00:00Z',
      collected: { a: '2026-01-01T00:00:00Z' },
    });
    expect(exported.customMarkers).toEqual([]);
  });
});

describe('manifest rules', () => {
  const base = readExampleJson('pack/manifest.json') as Record<string, unknown>;

  it('rejects a newer formatVersion at the schema level too', () => {
    expect(manifestSchema.safeParse({ ...base, formatVersion: 2 }).success).toBe(false);
  });

  it('requires at least one author and one map', () => {
    expect(manifestSchema.safeParse({ ...base, authors: [] }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...base, maps: [] }).success).toBe(false);
  });

  it('defaults tileSize to 256', () => {
    const maps = (base.maps as Record<string, unknown>[]).map((m) => {
      const rest = { ...m };
      delete rest.tileSize;
      return rest;
    });
    const parsed = manifestSchema.parse({ ...base, maps });
    expect(parsed.maps.every((m) => m.tileSize === 256)).toBe(true);
  });

  it('rejects maxZoom below minZoom', () => {
    const maps = (base.maps as Record<string, unknown>[]).map((m) => ({ ...m, minZoom: 5 }));
    const result = manifestSchema.safeParse({ ...base, maps });
    expect(result.success).toBe(false);
  });
});

describe('primitive schemas', () => {
  it('hex colors must be #RRGGBB', () => {
    expect(hexColorSchema.safeParse('#aBc123').success).toBe(true);
    expect(hexColorSchema.safeParse('#abc').success).toBe(false);
    expect(hexColorSchema.safeParse('abc123').success).toBe(false);
  });

  it('ids start alphanumeric and allow . _ : -', () => {
    expect(idSchema.safeParse('com.example.game').success).toBe(true);
    expect(idSchema.safeParse('ow-chest_001:a').success).toBe(true);
    expect(idSchema.safeParse('-bad').success).toBe(false);
    expect(idSchema.safeParse('has space').success).toBe(false);
    expect(idSchema.safeParse('').success).toBe(false);
  });

  it('semver', () => {
    expect(semverSchema.safeParse('1.2.0').success).toBe(true);
    expect(semverSchema.safeParse('1.2.0-beta.1+build').success).toBe(true);
    expect(semverSchema.safeParse('1.2').success).toBe(false);
    expect(semverSchema.safeParse('v1.2.0').success).toBe(false);
  });

  it('localized text accepts strings and language maps only', () => {
    expect(localizedTextSchema.safeParse('Hello').success).toBe(true);
    expect(localizedTextSchema.safeParse({ en: 'Hello', fr: 'Bonjour' }).success).toBe(true);
    expect(localizedTextSchema.safeParse({}).success).toBe(false);
    expect(localizedTextSchema.safeParse('').success).toBe(false);
    expect(localizedTextSchema.safeParse({ 'not a tag': 'x' }).success).toBe(false);
  });
});

describe('resolveLocalizedText', () => {
  it('returns plain strings as-is', () => {
    expect(resolveLocalizedText('Hi', 'fr', 'en')).toBe('Hi');
  });

  it('prefers the requested language, then the fallback, then anything', () => {
    const text = { en: 'Hello', fr: 'Bonjour' };
    expect(resolveLocalizedText(text, 'fr', 'en')).toBe('Bonjour');
    expect(resolveLocalizedText(text, 'de', 'en')).toBe('Hello');
    expect(resolveLocalizedText({ es: 'Hola' }, 'de', 'en')).toBe('Hola');
  });

  it('returns an empty string for undefined', () => {
    expect(resolveLocalizedText(undefined, 'en', 'en')).toBe('');
  });
});
