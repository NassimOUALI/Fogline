import { describe, expect, it } from 'vitest';
import { samplePack } from '../testing/sample-pack';
import { CategoryTree } from './category-tree';
import {
  applyFilter,
  createFilterState,
  EMPTY_FILTER,
  hiddenSet,
  normalizeFilter,
  setNodeVisible,
  showAll,
  toggleNode,
  withHideCollected,
} from './filter';

const pack = samplePack();
const tree = CategoryTree.fromData(pack.categories, pack.markers);
const noProgress = { collected: {} };

describe('createFilterState', () => {
  it('sorts and de-duplicates ids and freezes the result', () => {
    const filter = createFilterState(['relics', 'chest-common', 'relics'], true);
    expect(filter).toEqual({ hiddenNodeIds: ['chest-common', 'relics'], hideCollected: true });
    expect(Object.isFrozen(filter.hiddenNodeIds)).toBe(true);
  });
});

describe('normalizeFilter', () => {
  it('expands group ids to leaves and keeps unknown ids', () => {
    const filter = normalizeFilter(tree, createFilterState(['shrines', 'removed-category']));
    expect(filter.hiddenNodeIds).toEqual(['removed-category', 'shrine-fire', 'shrine-water']);
  });
});

describe('toggling nodes', () => {
  it('hides every leaf of a fully visible group', () => {
    const filter = toggleNode(tree, EMPTY_FILTER, 'collectibles');
    expect(filter.hiddenNodeIds).toEqual(['relics', 'shrine-fire', 'shrine-water']);
    expect(tree.find('collectibles')?.visibility(hiddenSet(filter))).toBe('none');
  });

  it('shows every leaf of a mixed group', () => {
    const mixed = createFilterState(['shrine-fire']);
    const filter = toggleNode(tree, mixed, 'collectibles');
    expect(filter.hiddenNodeIds).toEqual([]);
  });

  it('shows every leaf of a hidden group and leaves other categories alone', () => {
    const hidden = createFilterState(['relics', 'shrine-fire', 'shrine-water', 'waypoints']);
    const filter = toggleNode(tree, hidden, 'collectibles');
    expect(filter.hiddenNodeIds).toEqual(['waypoints']);
  });

  it('toggles a single leaf', () => {
    const hidden = toggleNode(tree, EMPTY_FILTER, 'relics');
    expect(hidden.hiddenNodeIds).toEqual(['relics']);
    expect(toggleNode(tree, hidden, 'relics').hiddenNodeIds).toEqual([]);
  });

  it('leaves the filter unchanged for unknown ids', () => {
    const filter = createFilterState(['relics']);
    expect(toggleNode(tree, filter, 'ghost')).toBe(filter);
    expect(setNodeVisible(tree, filter, 'ghost', true)).toBe(filter);
  });

  it('keeps hide-collected while changing categories', () => {
    const filter = toggleNode(tree, createFilterState([], true), 'relics');
    expect(filter.hideCollected).toBe(true);
    expect(showAll(filter)).toEqual({ hiddenNodeIds: [], hideCollected: true });
    expect(withHideCollected(filter, false).hiddenNodeIds).toEqual(['relics']);
  });
});

describe('applyFilter', () => {
  it('returns every marker for an empty filter', () => {
    expect(applyFilter(pack.markers, EMPTY_FILTER, noProgress)).toHaveLength(9);
  });

  it('drops markers of hidden leaves', () => {
    const filter = toggleNode(tree, EMPTY_FILTER, 'chests');
    const visible = applyFilter(pack.markers, filter, noProgress);
    expect(visible).toHaveLength(6);
    expect(visible.every((marker) => !marker.categoryId.startsWith('chest'))).toBe(true);
  });

  it('drops collected markers only when hide-collected is on', () => {
    const progress = { collected: { 'ow-chest-001': '2026-01-01T00:00:00Z' } };
    expect(applyFilter(pack.markers, EMPTY_FILTER, progress)).toHaveLength(9);
    const visible = applyFilter(pack.markers, createFilterState([], true), progress);
    expect(visible).toHaveLength(8);
    expect(visible.some((marker) => marker.id === 'ow-chest-001')).toBe(false);
  });

  it('combines category and collected filters', () => {
    const progress = { collected: { 'ow-waypoint-001': '2026-01-01T00:00:00Z' } };
    const filter = createFilterState(['chest-common', 'chest-rare'], true);
    const ids = applyFilter(pack.markers, filter, progress).map((marker) => marker.id);
    expect(ids).toEqual([
      'ow-shrine-001',
      'ow-shrine-002',
      'ow-relic-001',
      'cv-relic-001',
      'cv-waypoint-001',
    ]);
  });
});
