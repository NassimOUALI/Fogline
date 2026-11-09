import { describe, expect, it } from 'vitest';
import { SAMPLE_CATEGORIES, samplePack } from '../testing/sample-pack';
import { Category, CategoryTree, Group } from './category-tree';
import { markersOnMap } from './pack';

const pack = samplePack();
const wholePack = CategoryTree.fromData(pack.categories, pack.markers);
const overworld = CategoryTree.fromData(pack.categories, markersOnMap(pack, 'overworld'));

function node(tree: CategoryTree, id: string): NonNullable<ReturnType<CategoryTree['find']>> {
  const found = tree.find(id);
  if (found === undefined) {
    throw new Error(`No node ${id}`);
  }
  return found;
}

describe('composite counts', () => {
  it('counts leaves directly', () => {
    expect(node(wholePack, 'chest-rare').count()).toBe(2);
    expect(node(wholePack, 'shrine-fire').count()).toBe(1);
  });

  it('rolls counts up through nested groups', () => {
    expect(node(wholePack, 'shrines').count()).toBe(2);
    expect(node(wholePack, 'collectibles').count()).toBe(4); // 2 shrines + 2 relics
    expect(node(wholePack, 'chests').count()).toBe(3);
    expect(wholePack.count()).toBe(9);
  });

  it('counts per map when built from one map', () => {
    expect(node(overworld, 'collectibles').count()).toBe(3);
    expect(node(overworld, 'chests').count()).toBe(2);
    expect(overworld.count()).toBe(6);
  });

  it('rolls collected counts up and ignores ids the pack does not have', () => {
    const progress = {
      collected: {
        'ow-shrine-001': '2026-01-01T00:00:00Z',
        'cv-relic-001': '2026-01-01T00:00:00Z',
        'removed-in-update': '2026-01-01T00:00:00Z',
      },
    };
    expect(node(wholePack, 'shrine-fire').collectedCount(progress)).toBe(1);
    expect(node(wholePack, 'shrines').collectedCount(progress)).toBe(1);
    expect(node(wholePack, 'collectibles').collectedCount(progress)).toBe(2);
    expect(node(wholePack, 'chests').collectedCount(progress)).toBe(0);
    expect(wholePack.collectedCount(progress)).toBe(2);
  });

  it('lists leaf ids at any level', () => {
    expect(node(wholePack, 'collectibles').leafIds()).toEqual([
      'shrine-fire',
      'shrine-water',
      'relics',
    ]);
    expect(node(wholePack, 'waypoints').leafIds()).toEqual(['waypoints']);
    expect(wholePack.leafIds()).toHaveLength(6);
  });
});

describe('tri-state visibility', () => {
  const collectibles = node(wholePack, 'collectibles');

  it('is all when nothing below is hidden', () => {
    expect(collectibles.visibility(new Set())).toBe('all');
    expect(collectibles.visibility(new Set(['chest-common']))).toBe('all');
  });

  it('is none when every leaf below is hidden', () => {
    expect(collectibles.visibility(new Set(['shrine-fire', 'shrine-water', 'relics']))).toBe(
      'none',
    );
  });

  it('is mixed when some leaves are hidden, through nested groups', () => {
    const hidden = new Set(['shrine-fire']);
    expect(node(wholePack, 'shrines').visibility(hidden)).toBe('mixed');
    expect(collectibles.visibility(hidden)).toBe('mixed');
    expect(node(wholePack, 'relics').visibility(hidden)).toBe('all');
  });

  it('is mixed when a whole child group is hidden but a sibling is not', () => {
    expect(collectibles.visibility(new Set(['shrine-fire', 'shrine-water']))).toBe('mixed');
  });

  it('treats leaves as all or none', () => {
    expect(node(wholePack, 'relics').visibility(new Set(['relics']))).toBe('none');
  });

  it('treats an empty group as all', () => {
    expect(new Group({ id: 'g', name: 'G', children: [] }).visibility(new Set(['g']))).toBe('all');
  });
});

describe('CategoryTree', () => {
  it('finds nodes and their ancestors', () => {
    expect(wholePack.find('nope')).toBeUndefined();
    expect(wholePack.ancestorsOf('shrine-water').map((n) => n.id)).toEqual([
      'collectibles',
      'shrines',
    ]);
    expect(wholePack.ancestorsOf('waypoints')).toEqual([]);
    expect(node(wholePack, 'collectibles').find('shrine-water')?.id).toBe('shrine-water');
    expect(node(wholePack, 'relics').find('shrines')).toBeUndefined();
  });

  it('knows leaves from groups', () => {
    expect(wholePack.isLeaf('relics')).toBe(true);
    expect(wholePack.isLeaf('shrines')).toBe(false);
    expect(wholePack.isLeaf('nope')).toBe(false);
  });

  it('inherits color and icon from the nearest ancestor', () => {
    expect(wholePack.styleOf('chest-common')).toEqual({
      color: '#9aa3ad',
      icon: 'icons/chest.svg',
    });
    expect(wholePack.styleOf('relics')).toEqual({ color: '#8f5fd6', icon: undefined });
    expect(wholePack.styleOf('shrine-fire').color).toBe('#d9534f');
    expect(wholePack.styleOf('nope')).toEqual({ color: undefined, icon: undefined });
  });

  it('ignores markers that reference unknown or group categories', () => {
    const tree = CategoryTree.fromData(SAMPLE_CATEGORIES, [
      { id: 'a', categoryId: 'relics' },
      { id: 'b', categoryId: 'shrines' },
      { id: 'c', categoryId: 'ghost' },
    ]);
    expect(tree.count()).toBe(1);
  });

  it('appends extra roots such as the personal markers leaf', () => {
    const extra = new Category({ id: '_mine', name: 'Mine', markerIds: ['p1', 'p2'] });
    const tree = CategoryTree.fromData(SAMPLE_CATEGORIES, [], [extra]);
    expect(tree.roots.at(-1)?.id).toBe('_mine');
    expect(tree.count()).toBe(2);
  });

  it('produces immutable nodes', () => {
    const leaf = node(wholePack, 'relics');
    expect(Object.isFrozen(leaf)).toBe(true);
    expect(Object.isFrozen(wholePack.roots)).toBe(true);
  });
});
