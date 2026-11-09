import { describe, expect, it } from 'vitest';
import { SAMPLE_OVERWORLD_MARKERS, samplePack } from '../testing/sample-pack';
import { CategoryTree } from './category-tree';
import { createFilterState } from './filter';
import { hasMarker } from './pack';
import {
  addCustomMarker,
  collectedAt,
  emptyProgress,
  isCollected,
  removeCustomMarker,
  resetProgress,
  setCollected,
  staleMarkerIds,
  summarizeProgress,
  toggleCollected,
  updateCustomMarker,
  withFilters,
  withLastView,
  withPackVersionSeen,
  type CustomMarker,
} from './progress';

const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-02T10:00:00.000Z';
const pin: CustomMarker = {
  id: 'custom-0001',
  map: 'overworld',
  position: { x: 10, y: 20 },
  name: 'Camp',
  createdAt: T0,
};

describe('collected markers', () => {
  it('starts empty', () => {
    const progress = emptyProgress('p', T0);
    expect(progress).toMatchObject({
      packId: 'p',
      updatedAt: T0,
      collected: {},
      customMarkers: [],
    });
    expect(Object.isFrozen(progress)).toBe(true);
  });

  it('toggles with timestamps', () => {
    const on = toggleCollected(emptyProgress('p', T0), 'm1', T1);
    expect(isCollected(on, 'm1')).toBe(true);
    expect(collectedAt(on, 'm1')).toBe(T1);
    expect(on.updatedAt).toBe(T1);
    const off = toggleCollected(on, 'm1', T1);
    expect(isCollected(off, 'm1')).toBe(false);
    expect(collectedAt(off, 'm1')).toBeUndefined();
  });

  it('returns the same object when setting an unchanged value', () => {
    const progress = emptyProgress('p', T0);
    expect(setCollected(progress, 'm1', false, T1)).toBe(progress);
  });

  it('does not treat prototype keys as collected', () => {
    expect(isCollected(emptyProgress('p', T0), 'toString')).toBe(false);
  });
});

describe('personal markers', () => {
  const withPin = addCustomMarker(emptyProgress('p', T0), pin, T1);

  it('adds, updates and removes', () => {
    expect(withPin.customMarkers).toEqual([pin]);
    const renamed = updateCustomMarker(withPin, pin.id, { name: 'Base', note: 'Safe' }, T1);
    expect(renamed?.customMarkers[0]).toMatchObject({
      name: 'Base',
      note: 'Safe',
      position: pin.position,
    });
    const moved = updateCustomMarker(withPin, pin.id, { position: { x: 1, y: 2 } }, T1);
    expect(moved?.customMarkers[0]?.position).toEqual({ x: 1, y: 2 });
    expect(removeCustomMarker(withPin, pin.id, T1)?.customMarkers).toEqual([]);
  });

  it('returns undefined for unknown ids', () => {
    expect(updateCustomMarker(withPin, 'nope', { name: 'x' }, T1)).toBeUndefined();
    expect(removeCustomMarker(withPin, 'nope', T1)).toBeUndefined();
  });
});

describe('view state', () => {
  it('stores filters, last view and pack version', () => {
    let progress = emptyProgress('p', T0);
    progress = withFilters(progress, { hiddenNodeIds: ['b', 'a', 'a'], hideCollected: true }, T1);
    expect(progress.filters).toEqual(createFilterState(['a', 'b'], true));
    progress = withLastView(progress, { map: 'overworld', center: { x: 1, y: 2 }, zoom: 3 }, T1);
    expect(progress.lastView?.zoom).toBe(3);
    progress = withPackVersionSeen(progress, '2.0.0', T1);
    expect(progress.packVersionSeen).toBe('2.0.0');
  });
});

describe('resetProgress', () => {
  it('clears collected, pins and filters but keeps bookkeeping', () => {
    let progress = emptyProgress('p', T0);
    progress = toggleCollected(progress, 'm1', T0);
    progress = addCustomMarker(progress, pin, T0);
    progress = withFilters(progress, createFilterState(['relics'], true), T0);
    progress = withLastView(progress, { map: 'overworld', center: { x: 1, y: 2 }, zoom: 3 }, T0);
    progress = withPackVersionSeen(progress, '1.0.0', T0);
    expect(summarizeProgress(progress)).toEqual({
      collected: 1,
      customMarkers: 1,
      hiddenCategories: 1,
    });

    const reset = resetProgress(progress, T1);
    expect(summarizeProgress(reset)).toEqual({
      collected: 0,
      customMarkers: 0,
      hiddenCategories: 0,
    });
    expect(reset.filters.hideCollected).toBe(false);
    expect(reset.lastView).toEqual(progress.lastView);
    expect(reset.packVersionSeen).toBe('1.0.0');
    expect(reset.updatedAt).toBe(T1);
  });
});

describe('progress across a pack update', () => {
  // v1 has ow-chest-001 and ow-relic-001; v2 removes ow-relic-001 and adds ow-new-001.
  const v1 = samplePack({ version: '1.0.0' });
  const v2 = samplePack({
    version: '2.0.0',
    overworld: [
      ...SAMPLE_OVERWORLD_MARKERS.filter((marker) => marker.id !== 'ow-relic-001'),
      { id: 'ow-new-001', category: 'relics', position: { x: 10, y: 10 }, name: 'New relic' },
    ],
  });

  let progress = emptyProgress(v1.id, T0);
  progress = toggleCollected(progress, 'ow-chest-001', T0);
  progress = toggleCollected(progress, 'ow-relic-001', T0);

  it('keeps every collected id, including the removed one', () => {
    expect(Object.keys(progress.collected).sort()).toEqual(['ow-chest-001', 'ow-relic-001']);
    expect(staleMarkerIds(progress, (id) => hasMarker(v1, id))).toEqual([]);
    expect(staleMarkerIds(progress, (id) => hasMarker(v2, id))).toEqual(['ow-relic-001']);
  });

  it('counts only markers the new version contains', () => {
    const treeV1 = CategoryTree.fromData(v1.categories, v1.markers);
    const treeV2 = CategoryTree.fromData(v2.categories, v2.markers);
    expect(treeV1.collectedCount(progress)).toBe(2);
    expect(treeV2.collectedCount(progress)).toBe(1);
    expect(treeV2.find('relics')?.count()).toBe(2); // ow-new-001 + cv-relic-001
    expect(treeV2.find('relics')?.collectedCount(progress)).toBe(0);
  });

  it('lets new markers be collected alongside the old ones', () => {
    const next = toggleCollected(progress, 'ow-new-001', T1);
    const treeV2 = CategoryTree.fromData(v2.categories, v2.markers);
    expect(treeV2.collectedCount(next)).toBe(2);
    expect(Object.keys(next.collected)).toHaveLength(3);
  });
});
