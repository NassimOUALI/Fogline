/**
 * Contract suites (Liskov): every `ProgressStore` and `LibraryRepository` implementation must
 * pass these. Run them against the in-memory adapters here and the desktop JSON adapters later.
 */
import { describe, expect, it } from 'vitest';
import type { LibraryEntry } from '../domain/library';
import type { Progress } from '../domain/progress';
import type { LibraryRepository } from '../ports/library-repository';
import type { ProgressStore } from '../ports/progress-store';

export interface ContractFixture<T> {
  readonly subject: T;
  /**
   * Optional: a new instance over the same underlying storage, to prove data survives a
   * restart. Omit for purely in-memory implementations.
   */
  readonly reopen?: (() => Promise<T>) | undefined;
}

export function sampleProgressRecord(packId: string, overrides: Partial<Progress> = {}): Progress {
  return {
    packId,
    packVersionSeen: '1.2.0',
    updatedAt: '2026-10-18T15:52:30.000Z',
    collected: {
      'ow-chest-001': '2026-10-11T20:14:00.000Z',
      'ow-waypoint-001': '2026-10-11T20:20:41.000Z',
    },
    customMarkers: [
      {
        id: 'custom-0001',
        map: 'overworld',
        position: { x: 1750, y: 1900 },
        name: 'Good camping spot',
        note: 'Safe at night.',
        createdAt: '2026-10-12T19:05:00.000Z',
      },
    ],
    filters: { hiddenNodeIds: ['chest-common'], hideCollected: true },
    lastView: { map: 'overworld', center: { x: 1600, y: 1200 }, zoom: 2 },
    ...overrides,
  };
}

export function sampleLibraryEntry(
  packId: string,
  overrides: Partial<LibraryEntry> = {},
): LibraryEntry {
  return {
    packId,
    title: `${packId} title`,
    gameName: 'Example Game',
    version: '1.2.0',
    path: `D:/Packs/${packId}`,
    source: 'referenced',
    importedAt: '2026-10-10T18:02:11.000Z',
    lastOpenedAt: '2026-10-18T15:40:02.000Z',
    thumbnail: `thumbnails/${packId}.webp`,
    markerCount: 9,
    status: 'available',
    ...overrides,
  };
}

/** Plain JSON round-trip, to compare without frozen-object or prototype differences. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function describeProgressStoreContract(
  name: string,
  create: () => Promise<ContractFixture<ProgressStore>>,
): void {
  describe(`ProgressStore contract: ${name}`, () => {
    it('returns undefined for unknown packs', async () => {
      const { subject } = await create();
      expect(await subject.load('com.example.unknown')).toBeUndefined();
    });

    it('round-trips every field', async () => {
      const { subject } = await create();
      const progress = sampleProgressRecord('com.example.a');
      await subject.save(progress);
      expect(plain(await subject.load('com.example.a'))).toEqual(plain(progress));
    });

    it('round-trips a minimal record without optional fields', async () => {
      const { subject } = await create();
      const progress: Progress = {
        packId: 'com.example.min',
        updatedAt: '2026-01-01T00:00:00.000Z',
        collected: {},
        customMarkers: [],
        filters: { hiddenNodeIds: [], hideCollected: false },
      };
      await subject.save(progress);
      const loaded = await subject.load('com.example.min');
      expect(plain(loaded)).toEqual(plain(progress));
      expect(loaded?.lastView).toBeUndefined();
      expect(loaded?.packVersionSeen).toBeUndefined();
    });

    it('replaces progress with the same pack id', async () => {
      const { subject } = await create();
      await subject.save(sampleProgressRecord('com.example.a'));
      const replaced = sampleProgressRecord('com.example.a', { collected: {}, customMarkers: [] });
      await subject.save(replaced);
      expect(plain(await subject.load('com.example.a'))).toEqual(plain(replaced));
    });

    it('keeps packs apart', async () => {
      const { subject } = await create();
      const a = sampleProgressRecord('com.example.a');
      const b = sampleProgressRecord('com.example.b', { collected: {} });
      await subject.save(a);
      await subject.save(b);
      expect(plain(await subject.load('com.example.a'))).toEqual(plain(a));
      expect(plain(await subject.load('com.example.b'))).toEqual(plain(b));
    });

    it('deletes one pack and treats deleting unknown packs as a no-op', async () => {
      const { subject } = await create();
      await subject.save(sampleProgressRecord('com.example.a'));
      await subject.save(sampleProgressRecord('com.example.b'));
      await subject.delete('com.example.a');
      await subject.delete('com.example.never-saved');
      expect(await subject.load('com.example.a')).toBeUndefined();
      expect(await subject.load('com.example.b')).toBeDefined();
    });

    it('is not affected by later changes to the saved or loaded object', async () => {
      const { subject } = await create();
      const progress = plain(sampleProgressRecord('com.example.a'));
      await subject.save(progress);
      (progress.collected as Record<string, string>).mutated = '2026-01-01T00:00:00.000Z';
      const loaded = await subject.load('com.example.a');
      if (loaded !== undefined && !Object.isFrozen(loaded.collected)) {
        (loaded.collected as Record<string, string>)['mutated-too'] = '2026-01-01T00:00:00.000Z';
      }
      const again = await subject.load('com.example.a');
      expect(Object.keys(again?.collected ?? {})).toEqual(['ow-chest-001', 'ow-waypoint-001']);
    });

    it('stores thousands of collected markers', async () => {
      const { subject } = await create();
      const collected = Object.fromEntries(
        Array.from({ length: 5000 }, (_, i) => [`m-${String(i)}`, '2026-01-01T00:00:00.000Z']),
      );
      await subject.save(sampleProgressRecord('com.example.big', { collected }));
      expect(Object.keys((await subject.load('com.example.big'))?.collected ?? {})).toHaveLength(
        5000,
      );
    });

    it('survives reopening the same storage', async () => {
      const { subject, reopen } = await create();
      const progress = sampleProgressRecord('com.example.a');
      await subject.save(progress);
      if (reopen === undefined) {
        return; // purely in-memory implementation: nothing to reopen
      }
      const reopened = await reopen();
      expect(plain(await reopened.load('com.example.a'))).toEqual(plain(progress));
    });
  });
}

export function describeLibraryRepositoryContract(
  name: string,
  create: () => Promise<ContractFixture<LibraryRepository>>,
): void {
  describe(`LibraryRepository contract: ${name}`, () => {
    it('starts empty', async () => {
      const { subject } = await create();
      expect(await subject.list()).toEqual([]);
      expect(await subject.get('com.example.a')).toBeUndefined();
    });

    it('saves and gets an entry with every field', async () => {
      const { subject } = await create();
      const entry = sampleLibraryEntry('com.example.a');
      await subject.save(entry);
      expect(plain(await subject.get('com.example.a'))).toEqual(plain(entry));
      expect(plain(await subject.list())).toEqual([plain(entry)]);
    });

    it('round-trips an entry without optional fields', async () => {
      const { subject } = await create();
      const entry = sampleLibraryEntry('com.example.a');
      delete (entry as Partial<LibraryEntry>).lastOpenedAt;
      delete (entry as Partial<LibraryEntry>).thumbnail;
      await subject.save(entry);
      const loaded = await subject.get('com.example.a');
      expect(plain(loaded)).toEqual(plain(entry));
      expect(loaded?.lastOpenedAt).toBeUndefined();
    });

    it('replaces the entry with the same pack id instead of duplicating it', async () => {
      const { subject } = await create();
      await subject.save(sampleLibraryEntry('com.example.a'));
      await subject.save(
        sampleLibraryEntry('com.example.a', { version: '2.0.0', status: 'missing' }),
      );
      const all = await subject.list();
      expect(all).toHaveLength(1);
      expect(all[0]?.version).toBe('2.0.0');
      expect(all[0]?.status).toBe('missing');
    });

    it('lists several entries', async () => {
      const { subject } = await create();
      await subject.save(sampleLibraryEntry('com.example.a'));
      await subject.save(sampleLibraryEntry('com.example.b', { source: 'copied' }));
      const ids = (await subject.list()).map((entry) => entry.packId).sort();
      expect(ids).toEqual(['com.example.a', 'com.example.b']);
    });

    it('removes one entry and treats removing unknown ids as a no-op', async () => {
      const { subject } = await create();
      await subject.save(sampleLibraryEntry('com.example.a'));
      await subject.save(sampleLibraryEntry('com.example.b'));
      await subject.remove('com.example.a');
      await subject.remove('com.example.never-saved');
      expect((await subject.list()).map((entry) => entry.packId)).toEqual(['com.example.b']);
    });

    it('is not affected by later changes to the saved or returned object', async () => {
      const { subject } = await create();
      const entry = sampleLibraryEntry('com.example.a');
      await subject.save(entry);
      entry.title = 'mutated';
      const loaded = await subject.get('com.example.a');
      if (loaded !== undefined) {
        loaded.title = 'mutated too';
      }
      expect((await subject.get('com.example.a'))?.title).toBe('com.example.a title');
    });

    it('survives reopening the same storage', async () => {
      const { subject, reopen } = await create();
      const entry = sampleLibraryEntry('com.example.a');
      await subject.save(entry);
      if (reopen === undefined) {
        return;
      }
      const reopened = await reopen();
      expect(plain(await reopened.get('com.example.a'))).toEqual(plain(entry));
    });
  });
}
