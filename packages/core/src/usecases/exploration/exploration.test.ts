import { describe, expect, it } from 'vitest';
import type { CategoryTree } from '../../domain/category-tree';
import { createFilterState, EMPTY_FILTER } from '../../domain/filter';
import { MY_MARKERS_ID } from '../../domain/personal-markers';
import { addCustomMarker, emptyProgress, setCollected } from '../../domain/progress';
import { generatedMarkers, samplePack } from '../../testing/sample-pack';
import { ApplyFilter, BuildCategoryTree, GetMarkerDetails, SearchMarkers } from './exploration';

const NOW = '2026-11-09T12:00:00.000Z';
const pack = samplePack();
let progress = emptyProgress(pack.id, NOW);
progress = setCollected(progress, 'ow-waypoint-001', true, NOW);
progress = addCustomMarker(
  progress,
  { id: 'custom-0001', map: 'overworld', position: { x: 1, y: 1 }, name: 'Camp', createdAt: NOW },
  NOW,
);
progress = addCustomMarker(
  progress,
  { id: 'custom-0002', map: 'caves', position: { x: 1, y: 1 }, name: 'Gem', createdAt: NOW },
  NOW,
);

function treeFor(mapId?: string): CategoryTree {
  const result = new BuildCategoryTree().execute({ pack, mapId, progress });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('BuildCategoryTree', () => {
  it('counts per map and adds the My markers leaf for that map', () => {
    const tree = treeFor('overworld');
    expect(tree.find('chests')?.count()).toBe(2);
    expect(tree.find(MY_MARKERS_ID)?.count()).toBe(1);
    expect(tree.collectedCount(progress)).toBe(1);
  });

  it('builds a whole-pack tree without personal markers', () => {
    const tree = treeFor();
    expect(tree.count()).toBe(9);
    expect(tree.find(MY_MARKERS_ID)).toBeUndefined();
  });

  it('refuses unknown maps', () => {
    const result = new BuildCategoryTree().execute({ pack, mapId: 'moon' });
    expect(result.ok ? undefined : result.error.code).toBe('map.notFound');
  });
});

describe('ApplyFilter', () => {
  const apply = new ApplyFilter();
  const tree = treeFor('overworld');

  it('returns the visible markers and pins of one map', () => {
    const visible = apply.execute({
      pack,
      tree,
      mapId: 'overworld',
      filter: EMPTY_FILTER,
      progress,
    });
    expect(visible.markers).toHaveLength(6);
    expect(visible.customMarkers.map((m) => m.id)).toEqual(['custom-0001']);
  });

  it('expands stored group ids, hides collected, and hides pins with their leaf', () => {
    const filter = createFilterState(['chests', MY_MARKERS_ID], true);
    const visible = apply.execute({ pack, tree, mapId: 'overworld', filter, progress });
    expect(visible.markers.map((m) => m.id)).toEqual([
      'ow-shrine-001',
      'ow-shrine-002',
      'ow-relic-001',
    ]);
    expect(visible.customMarkers).toEqual([]);
    expect(visible.filter.hiddenNodeIds).toEqual([MY_MARKERS_ID, 'chest-common', 'chest-rare']);
  });

  it('filters 20,000 markers quickly', () => {
    const big = samplePack({ overworld: generatedMarkers(20000) });
    const bigTree = new BuildCategoryTree().execute({ pack: big, mapId: 'overworld' });
    if (!bigTree.ok) {
      throw new Error('tree failed');
    }
    const started = performance.now();
    const visible = apply.execute({
      pack: big,
      tree: bigTree.value,
      mapId: 'overworld',
      filter: createFilterState(['relics']),
      progress: emptyProgress(big.id, NOW),
    });
    const elapsed = performance.now() - started;
    expect(visible.markers.length).toBeGreaterThan(16000);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('SearchMarkers', () => {
  it('searches across maps and reuses its index', () => {
    const search = new SearchMarkers();
    const first = search.execute({ pack, query: 'waypoint', language: 'en' });
    expect(first.map((r) => r.marker.mapId)).toEqual(['caves', 'overworld']);
    const second = search.execute({
      pack,
      query: 'tablet',
      language: 'en',
      options: { mapId: 'overworld' },
    });
    expect(second.map((r) => r.marker.id)).toEqual(['ow-relic-001']);
    expect(search.execute({ pack, query: 'coffre', language: 'fr' })).toHaveLength(1);
  });
});

describe('GetMarkerDetails', () => {
  it('returns details or marker.notFound', () => {
    const get = new GetMarkerDetails();
    const tree = treeFor('overworld');
    const details = get.execute({
      pack,
      tree,
      markerId: 'ow-waypoint-001',
      progress,
      language: 'en',
    });
    expect(details.ok && details.value.collected).toBe(true);
    const missing = get.execute({ pack, tree, markerId: 'nope', progress, language: 'en' });
    expect(missing.ok ? undefined : missing.error.code).toBe('marker.notFound');
  });
});
