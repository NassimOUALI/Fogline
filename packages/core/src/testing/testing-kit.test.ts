import { describe, expect, it } from 'vitest';
import { findMap } from '../domain/pack';
import { selectTileSource } from '../ports/tile-source';
import { describeLibraryRepositoryContract, describeProgressStoreContract } from './contracts';
import {
  FakeTileSource,
  FixedClock,
  InMemoryFileSystem,
  RecordingMapRenderer,
  SequentialIdGenerator,
} from './in-memory-io';
import { InMemoryLibraryRepository, InMemoryProgressStore } from './in-memory-stores';
import { samplePack } from './sample-pack';

describeProgressStoreContract('InMemoryProgressStore', () =>
  Promise.resolve({ subject: new InMemoryProgressStore() }),
);

describeLibraryRepositoryContract('InMemoryLibraryRepository', () =>
  Promise.resolve({ subject: new InMemoryLibraryRepository() }),
);

describe('contract suites with reopen', () => {
  // Proves the reopen branch works: both fixtures share one underlying instance.
  const progress = new InMemoryProgressStore();
  describeProgressStoreContract('InMemoryProgressStore (shared instance)', () =>
    Promise.resolve({ subject: progress, reopen: () => Promise.resolve(progress) }),
  );
  const library = new InMemoryLibraryRepository();
  describeLibraryRepositoryContract('InMemoryLibraryRepository (shared instance)', () => {
    return library.list().then(async (entries) => {
      for (const entry of entries) {
        await library.remove(entry.packId);
      }
      return { subject: library, reopen: () => Promise.resolve(library) };
    });
  });
});

describe('in-memory helpers', () => {
  it('FixedClock moves only when told', () => {
    const clock = new FixedClock('2026-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });

  it('SequentialIdGenerator pads ids', () => {
    const ids = new SequentialIdGenerator();
    expect([ids.next(), ids.next()]).toEqual(['custom-0001', 'custom-0002']);
    expect(new SequentialIdGenerator('pin-').next()).toBe('pin-0001');
  });

  it('InMemoryFileSystem refuses to trash missing paths and serves text files and pickers', async () => {
    const files = new InMemoryFileSystem();
    await expect(files.moveToTrash('/nope')).rejects.toThrow('missing');
    await expect(files.readText('/nope.json')).rejects.toThrow('No such file');
    await files.writeText('/out.json', '{}');
    expect(await files.readText('/out.json')).toBe('{}');
    expect(await files.exists('/out.json')).toBe(true);
    files.pickerAnswers.push('/a', undefined, '/c');
    expect(await files.pickFolder()).toBe('/a');
    expect(await files.pickFile([])).toBeUndefined();
    expect(await files.pickSaveLocation('x.json', [])).toBe('/c');
    files.addPath('/p').removePath('/p');
    expect(await files.exists('/p')).toBe(false);
  });

  it('selectTileSource picks by tile type and reports unsupported maps', () => {
    const pack = samplePack();
    const overworld = findMap(pack, 'overworld');
    const caves = findMap(pack, 'caves');
    if (overworld === undefined || caves === undefined) {
      throw new Error('maps missing');
    }
    const xyz = new FakeTileSource(['xyz']);
    expect(selectTileSource([xyz], overworld)).toBe(xyz);
    expect(selectTileSource([xyz], caves)).toBeUndefined();
    expect(xyz.tileUrl('D:/p', overworld, { z: 1, x: 2, y: 3 })).toBe(
      'fake://D:/p/maps/overworld/tiles/1/2/3',
    );
  });

  it('RecordingMapRenderer records calls and delivers events until unsubscribed', () => {
    const renderer = new RecordingMapRenderer();
    const pack = samplePack();
    const map = pack.maps[0];
    if (map === undefined) {
      throw new Error('no map');
    }
    renderer.showMap({
      map,
      tileUrl: () => '',
      backdrop: '#000000',
      viewport: { center: { x: 1, y: 2 }, zoom: 1 },
    });
    expect(renderer.getViewport()?.zoom).toBe(1);
    renderer.setViewport({ center: { x: 0, y: 0 }, zoom: 3 });
    renderer.setMarkers([
      {
        id: 'a',
        kind: 'pack',
        position: { x: 0, y: 0 },
        label: 'A',
        color: '#fff000',
        dimmed: false,
      },
    ]);
    renderer.highlight('a');
    const seen: string[] = [];
    const unsubscribe = renderer.subscribe((event) => seen.push(event.type));
    renderer.emit({ type: 'markerclick', markerId: 'a' });
    unsubscribe();
    renderer.emit({ type: 'click', position: { x: 0, y: 0 } });
    renderer.destroy();
    expect(seen).toEqual(['markerclick']);
    expect([
      renderer.markers.length,
      renderer.highlighted,
      renderer.viewport?.zoom,
      renderer.destroyed,
    ]).toEqual([1, 'a', 3, true]);
  });
});
