import { describe, expect, it } from 'vitest';
import { sampleLibraryEntry } from '../testing/contracts';
import { samplePack } from '../testing/sample-pack';
import { CategoryTree } from './category-tree';
import {
  createLibraryEntry,
  markOpened,
  refreshEntryFromPack,
  sortByRecent,
  withPath,
  withStatus,
} from './library';
import { describeMarker } from './marker-details';
import type { Marker } from './pack';
import { MY_MARKERS_ID, personalMarkersCategory } from './personal-markers';
import { emptyProgress, setCollected } from './progress';
import { fail, ok } from './result';
import { MarkerSearchIndex, normalizeForSearch } from './search';

const pack = samplePack();
const NOW = '2026-11-09T12:00:00.000Z';
const baseMarker: Marker = {
  id: 'base',
  mapId: 'overworld',
  categoryId: 'relics',
  position: { x: 0, y: 0 },
  name: 'Base',
  attributes: [],
  tags: [],
};

describe('library entries', () => {
  it('are created from a pack with a resolved title and cached count', () => {
    const entry = createLibraryEntry(pack, { path: 'D:/p', source: 'referenced' }, NOW);
    expect(entry).toEqual({
      packId: pack.id,
      title: 'Sample Game - Complete Map',
      gameName: 'Sample Game',
      version: '1.0.0',
      path: 'D:/p',
      source: 'referenced',
      importedAt: NOW,
      markerCount: 9,
      status: 'available',
    });
  });

  it('refresh from a newer pack and keep timestamps', () => {
    const old = sampleLibraryEntry(pack.id, {
      version: '0.9.0',
      markerCount: 1,
      status: 'missing',
    });
    const refreshed = refreshEntryFromPack(old, pack);
    expect(refreshed).toMatchObject({ version: '1.0.0', markerCount: 9, status: 'available' });
    expect(refreshed.importedAt).toBe(old.importedAt);
    expect(refreshed.thumbnail).toBe(old.thumbnail);
    expect(refreshed.path).toBe(old.path);
  });

  it('change status, path and last opened immutably', () => {
    const entry = sampleLibraryEntry('a');
    expect(withStatus(entry, 'missing').status).toBe('missing');
    expect(withPath(entry, 'E:/x').path).toBe('E:/x');
    expect(markOpened(entry, NOW).lastOpenedAt).toBe(NOW);
    expect(entry.status).toBe('available');
  });

  it('sort by last opened, then import time for never-opened packs, then title', () => {
    const older = sampleLibraryEntry('older', { lastOpenedAt: '2026-01-01T00:00:00Z' });
    const newer = sampleLibraryEntry('newer', { lastOpenedAt: '2026-06-01T00:00:00Z' });
    const neverOpened = { ...sampleLibraryEntry('fresh', { importedAt: '2026-03-01T00:00:00Z' }) };
    delete (neverOpened as { lastOpenedAt?: string }).lastOpenedAt;
    const tieB = sampleLibraryEntry('b', { title: 'B', lastOpenedAt: '2025-01-01T00:00:00Z' });
    const tieA = sampleLibraryEntry('a', { title: 'A', lastOpenedAt: '2025-01-01T00:00:00Z' });
    expect(sortByRecent([older, tieB, neverOpened, newer, tieA]).map((e) => e.packId)).toEqual([
      'newer',
      'fresh',
      'older',
      'a',
      'b',
    ]);
  });
});

describe('search', () => {
  const index = new MarkerSearchIndex(pack.markers, 'en', 'en');

  it('normalizes case, accents and spaces', () => {
    expect(normalizeForSearch('  Épée   RARE ')).toBe('epee rare');
  });

  it('ranks exact, prefix, word prefix, then substring matches', () => {
    expect(index.search('cave').map((r) => r.name)).toEqual([
      'Cave entrance waypoint',
      'Deep cave chest',
    ]);
    expect(index.search('chest').map((r) => r.name)).toEqual([
      'Deep cave chest',
      'Hidden vault chest',
      'Roadside chest',
    ]);
    expect(index.search('Ember shrine')[0]?.marker.id).toBe('ow-shrine-001');
    expect(index.search('ault').map((r) => r.marker.id)).toEqual(['ow-chest-002']);
  });

  it('matches all words in any order', () => {
    expect(index.search('chest deep').map((r) => r.marker.id)).toEqual(['cv-chest-001']);
  });

  it('filters by map and limits results', () => {
    expect(index.search('chest', { mapId: 'caves' }).map((r) => r.marker.id)).toEqual([
      'cv-chest-001',
    ]);
    expect(index.search('chest', { limit: 1 })).toHaveLength(1);
  });

  it('returns nothing for blank queries or no match', () => {
    expect(index.search('   ')).toEqual([]);
    expect(index.search('dragon')).toEqual([]);
  });

  it('searches the requested language and ignores accents', () => {
    const french = new MarkerSearchIndex(pack.markers, 'fr', 'en');
    expect(french.search('COFFRE')[0]?.name).toBe('Coffre au bord de la route');
    const accented: Marker = { ...baseMarker, id: 'x', name: 'Épée ancienne' };
    expect(new MarkerSearchIndex([accented], 'en', 'en').search('epee')).toHaveLength(1);
  });

  it('stays fast for 20,000 markers', () => {
    const markers: Marker[] = Array.from({ length: 20000 }, (_, i) => ({
      ...baseMarker,
      id: `m-${String(i)}`,
      name: `Generated marker ${String(i)}`,
    }));
    const big = new MarkerSearchIndex(markers, 'en', 'en');
    const started = performance.now();
    const results = big.search('marker 1999');
    const elapsed = performance.now() - started;
    expect(results[0]?.marker.id).toBe('m-1999');
    expect(elapsed).toBeLessThan(200);
  });
});

describe('describeMarker', () => {
  const tree = CategoryTree.fromData(pack.categories, pack.markers);

  it('resolves every field for the detail panel', () => {
    const progress = setCollected(emptyProgress(pack.id, NOW), 'ow-chest-002', true, NOW);
    expect(describeMarker(pack, tree, 'ow-chest-002', progress, 'fr')).toEqual({
      id: 'ow-chest-002',
      name: 'Hidden vault chest',
      description: undefined,
      mapId: 'overworld',
      mapName: 'Overworld',
      position: { x: 2600, y: 800 },
      category: {
        id: 'chest-rare',
        name: 'Rare',
        path: ['Coffres'],
        color: '#d9a441',
        icon: 'icons/chest.svg',
      },
      attributes: [
        { key: 'rarity', label: 'Rareté', value: 'Rare' },
        { key: 'gold', label: 'Gold', value: 250 },
        { key: 'locked', label: 'Locked', value: true },
      ],
      article: { id: 'waterfall-secrets', path: 'data/articles/waterfall-secrets.md' },
      collected: true,
      collectedAt: NOW,
    });
  });

  it('handles plain descriptions, missing articles and uncollected markers', () => {
    const details = describeMarker(pack, tree, 'ow-chest-001', emptyProgress(pack.id, NOW), 'en');
    expect(details?.description).toBe('Found beside the old road.');
    expect(details?.article).toBeUndefined();
    expect(details?.collected).toBe(false);
    expect(details?.category.path).toEqual(['Chests']);
  });

  it('falls back to the category id when the tree lacks it', () => {
    const emptyTree = CategoryTree.fromData([], []);
    const details = describeMarker(
      pack,
      emptyTree,
      'ow-chest-001',
      emptyProgress(pack.id, NOW),
      'en',
    );
    expect(details?.category.name).toBe('chest-common');
  });

  it('returns undefined for unknown markers', () => {
    expect(describeMarker(pack, tree, 'nope', emptyProgress(pack.id, NOW), 'en')).toBeUndefined();
  });
});

describe('personal markers category and results', () => {
  it('holds the pins of one map under the reserved id', () => {
    const leaf = personalMarkersCategory(
      [
        { id: 'p1', map: 'overworld', position: { x: 0, y: 0 }, name: 'a', createdAt: NOW },
        { id: 'p2', map: 'caves', position: { x: 0, y: 0 }, name: 'b', createdAt: NOW },
      ],
      'overworld',
    );
    expect(leaf.id).toBe(MY_MARKERS_ID);
    expect(leaf.markerIds).toEqual(['p1']);
  });

  it('builds results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(fail('input.invalid', 'bad')).toEqual({
      ok: false,
      error: { code: 'input.invalid', message: 'bad' },
    });
  });
});
