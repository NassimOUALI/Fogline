/** Tie-breaks and edge cases that keep results deterministic. */
import { describe, expect, it } from 'vitest';
import { sampleLibraryEntry, sampleProgressRecord } from '../testing/contracts';
import { InMemoryPackReader } from '../testing/in-memory-io';
import { InMemoryLibraryRepository, InMemoryProgressStore } from '../testing/in-memory-stores';
import { samplePack, samplePackData } from '../testing/sample-pack';
import { CategoryTree } from './category-tree';
import { sortByRecent } from './library';
import { createPack, markersOnMap, type Marker } from './pack';
import { addCustomMarker, emptyProgress, updateCustomMarker } from './progress';
import { MarkerSearchIndex } from './search';

const NOW = '2026-11-09T12:00:00.000Z';

describe('ordering tie-breaks', () => {
  it('sorts maps with equal order by id', () => {
    const data = samplePackData();
    const maps = data.manifest.maps.map((map) => ({ ...map, order: 1 }));
    const pack = createPack({ ...data, manifest: { ...data.manifest, maps } });
    expect(pack.maps.map((map) => map.id)).toEqual(['caves', 'overworld']);
  });

  it('sorts library entries with equal time and title by pack id', () => {
    const same = { title: 'Same', lastOpenedAt: NOW };
    const sorted = sortByRecent([sampleLibraryEntry('b', same), sampleLibraryEntry('a', same)]);
    expect(sorted.map((entry) => entry.packId)).toEqual(['a', 'b']);
  });

  it('sorts search hits with equal score and name by marker id', () => {
    const marker = (id: string): Marker => ({
      id,
      mapId: 'm',
      categoryId: 'c',
      position: { x: 0, y: 0 },
      name: 'Twin chest',
      attributes: [],
      tags: [],
    });
    const index = new MarkerSearchIndex([marker('z'), marker('a')], 'en', 'en');
    expect(index.search('twin').map((result) => result.marker.id)).toEqual(['a', 'z']);
  });
});

describe('edge cases', () => {
  it('gives a map without a markers entry an empty marker list', () => {
    const data = samplePackData();
    const { caves: _caves, ...markers } = data.markers;
    const pack = createPack({ ...data, markers });
    expect(markersOnMap(pack, 'caves')).toEqual([]);
    expect(pack.markers).toHaveLength(6);
  });

  it('finds a group by its own id and misses unknown ids below it', () => {
    const pack = samplePack();
    const tree = CategoryTree.fromData(pack.categories, pack.markers);
    const group = tree.find('collectibles');
    expect(group?.find('collectibles')).toBe(group);
    expect(group?.find('ghost')).toBeUndefined();
  });

  it('updates one personal marker among several', () => {
    let progress = emptyProgress('p', NOW);
    for (const id of ['a', 'b']) {
      progress = addCustomMarker(
        progress,
        { id, map: 'overworld', position: { x: 0, y: 0 }, name: id, createdAt: NOW },
        NOW,
      );
    }
    const updated = updateCustomMarker(progress, 'b', { name: 'renamed' }, NOW);
    expect(updated?.customMarkers.map((marker) => marker.name)).toEqual(['a', 'renamed']);
  });

  it('seeds in-memory stores and forgets reader locations', async () => {
    const library = new InMemoryLibraryRepository([sampleLibraryEntry('a')]);
    const progress = new InMemoryProgressStore([sampleProgressRecord('a')]);
    expect(await library.get('a')).toBeDefined();
    expect(await progress.load('a')).toBeDefined();
    const reader = new InMemoryPackReader().addPack('/p', samplePack()).removeLocation('/p');
    expect(await reader.readPackId('/p')).toBeUndefined();
    expect((await reader.read('/p')).ok).toBe(false);
  });
});
