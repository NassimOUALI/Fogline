import type { ParsedPack } from '@fogline/pack-format';
import { describe, expect, it } from 'vitest';
import categories from '../../../../examples/pack/data/categories.json';
import caves from '../../../../examples/pack/data/markers/caves.json';
import overworld from '../../../../examples/pack/data/markers/overworld.json';
import manifest from '../../../../examples/pack/manifest.json';
import { samplePack, samplePackData } from '../testing/sample-pack';
import { CategoryTree } from './category-tree';
import {
  createPack,
  findMap,
  findMarker,
  hasMarker,
  isInsideMap,
  markersOnMap,
  packTitle,
} from './pack';

describe('createPack', () => {
  const pack = samplePack();

  it('sorts maps by order', () => {
    expect(pack.maps.map((map) => map.id)).toEqual(['overworld', 'caves']);
  });

  it('flattens markers in map order and records their map', () => {
    expect(pack.markers).toHaveLength(9);
    expect(pack.markers[0]?.mapId).toBe('overworld');
    expect(pack.markers.at(-1)?.mapId).toBe('caves');
  });

  it('maps marker fields and fills optional lists', () => {
    const marker = findMarker(pack, 'ow-chest-002');
    expect(marker?.categoryId).toBe('chest-rare');
    expect(marker?.articleId).toBe('waterfall-secrets');
    expect(marker?.attributes).toHaveLength(3);
    expect(findMarker(pack, 'ow-shrine-001')?.attributes).toEqual([]);
    expect(findMarker(pack, 'ow-relic-001')?.tags).toEqual(['region:east']);
  });

  it('carries manifest metadata', () => {
    expect(pack.id).toBe('com.example.sample-game');
    expect(pack.game.name).toBe('Sample Game');
    expect(pack.palette?.accent).toBe('#c98a3c');
    expect(pack.attribution).toEqual([]);
  });

  it('is deeply frozen and does not alias its input', () => {
    const data = samplePackData();
    const fromData = createPack(data);
    expect(Object.isFrozen(fromData)).toBe(true);
    expect(Object.isFrozen(fromData.markers[0]?.position)).toBe(true);
    expect(Object.isFrozen(data.manifest)).toBe(false);
  });
});

describe('pack look-ups', () => {
  const pack = samplePack();

  it('finds maps and markers by id', () => {
    expect(findMap(pack, 'caves')?.maxZoom).toBe(3);
    expect(findMap(pack, 'nope')).toBeUndefined();
    expect(findMarker(pack, 'cv-relic-001')?.mapId).toBe('caves');
    expect(hasMarker(pack, 'nope')).toBe(false);
  });

  it('lists the markers of one map', () => {
    expect(markersOnMap(pack, 'caves').map((marker) => marker.id)).toEqual([
      'cv-chest-001',
      'cv-relic-001',
      'cv-waypoint-001',
    ]);
    expect(markersOnMap(pack, 'nope')).toEqual([]);
  });

  it('localizes the title', () => {
    expect(packTitle(pack)).toBe('Sample Game - Complete Map');
    expect(packTitle(pack, 'fr')).toBe('Sample Game - Carte complète');
  });

  it('checks positions against map bounds', () => {
    const map = findMap(pack, 'overworld');
    expect(map).toBeDefined();
    if (map === undefined) {
      return;
    }
    expect(isInsideMap(map, { x: 0, y: 0 })).toBe(true);
    expect(isInsideMap(map, { x: 4096, y: 3072 })).toBe(true);
    expect(isInsideMap(map, { x: -1, y: 10 })).toBe(false);
    expect(isInsideMap(map, { x: 10, y: 3073 })).toBe(false);
    expect(isInsideMap(map, { x: Number.NaN, y: 10 })).toBe(false);
  });
});

describe('the repository example pack', () => {
  // JSON imports widen literal types; the pack-format validator guarantees the shape at runtime.
  const data = {
    manifest,
    categories,
    markers: { overworld, caves },
  } as unknown as ParsedPack;

  it('loads into the domain with the documented counts', () => {
    const pack = createPack(data);
    const tree = CategoryTree.fromData(pack.categories, pack.markers);
    expect(pack.maps.map((map) => map.id)).toEqual(['overworld', 'caves']);
    expect(tree.count()).toBe(9);
    expect(tree.find('collectibles')?.count()).toBe(4);
    expect(tree.find('shrines')?.count()).toBe(2);
  });
});
