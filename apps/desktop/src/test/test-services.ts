import type { LibraryEntry, Pack, Progress } from '@fogline/core';
import {
  FixedClock,
  InMemoryFileSystem,
  InMemoryLibraryRepository,
  InMemoryPackReader,
  InMemoryProgressStore,
  SequentialIdGenerator,
} from '@fogline/core/testing';
import type { ThumbnailCache } from '../adapters/thumbnails';
import { createServices, type AppServices } from '../services/services';

export const TEST_NOW = '2026-11-09T12:00:00.000Z';

export interface TestPlatform {
  readonly services: AppServices;
  readonly library: InMemoryLibraryRepository;
  readonly progress: InMemoryProgressStore;
  readonly reader: InMemoryPackReader;
  readonly files: InMemoryFileSystem;
  readonly clock: FixedClock;
  readonly cachedThumbnails: string[];
}

/** Services over core's in-memory adapters, for UI and composition tests. */
export function createTestPlatform(
  options: {
    readonly packs?: Readonly<Record<string, Pack>>;
    readonly entries?: readonly LibraryEntry[];
    readonly progress?: readonly Progress[];
  } = {},
): TestPlatform {
  const library = new InMemoryLibraryRepository(options.entries ?? []);
  const progress = new InMemoryProgressStore(options.progress ?? []);
  const reader = new InMemoryPackReader();
  const files = new InMemoryFileSystem();
  for (const [location, pack] of Object.entries(options.packs ?? {})) {
    reader.addPack(location, pack);
    files.addPath(location);
  }
  const clock = new FixedClock(TEST_NOW);
  const cachedThumbnails: string[] = [];
  const thumbnails: ThumbnailCache = {
    cacheFor: (entry) => {
      cachedThumbnails.push(entry.packId);
      return Promise.resolve(`thumbnails/${entry.packId}.webp`);
    },
  };
  const services = createServices({
    library,
    progress,
    reader,
    files,
    clock,
    ids: new SequentialIdGenerator(),
    thumbnails,
    appDataUrl: (path) => `appdata://${path}`,
  });
  return { services, library, progress, reader, files, clock, cachedThumbnails };
}
