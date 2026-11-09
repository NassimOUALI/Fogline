import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sampleLibraryEntry } from '@fogline/core/testing';
import { EXAMPLES_DIR, FIXTURES_DIR } from '@fogline/pack-format/testing';
import { NodeAppFiles } from '../test/node-app-files';
import { joinPath, type AppFiles } from './app-files';
import { FilesPackReader } from './files-pack-reader';
import { randomIdGenerator, systemClock } from './system';
import { PackThumbnailCache, thumbnailSourceFor } from './thumbnails';

describe('joinPath', () => {
  it('joins with single separators and keeps Windows drive paths', () => {
    expect(joinPath('C:\\Users\\me\\AppData\\', 'library.json')).toBe(
      'C:\\Users\\me\\AppData/library.json',
    );
    expect(joinPath('/data/', '/progress/', 'a.json')).toBe('/data/progress/a.json');
    expect(joinPath('', 'a')).toBe('a');
  });
});

describe('FilesPackReader', () => {
  const reader = new FilesPackReader(new NodeAppFiles());

  it('reads and validates a pack folder into a domain pack', async () => {
    const result = await reader.read(join(FIXTURES_DIR, 'valid-pack'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.id).toBe('dev.fogline.fixture');
      expect(result.pack.markers).toHaveLength(3);
      expect(result.warnings).toEqual([]);
    }
  });

  it('returns validation errors for a pack with missing files', async () => {
    const result = await reader.read(join(EXAMPLES_DIR, 'pack'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(new Set(result.errors.map((issue) => issue.code))).toEqual(
        new Set(['file.missing', 'tiles.missing']),
      );
    }
  });

  it('reports an unreadable folder as an error instead of throwing', async () => {
    const failing: AppFiles = {
      readText: () => Promise.reject(new Error('permission denied')),
      exists: () => Promise.resolve(false),
      writeText: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const result = await new FilesPackReader(failing).read('/locked');
    expect(result.ok ? '' : result.errors[0]?.message).toContain('permission denied');
  });

  it('reads the pack id of a folder without validating it', async () => {
    expect(await reader.readPackId(join(EXAMPLES_DIR, 'pack'))).toBe('com.example.example-game');
    expect(await reader.readPackId(join(EXAMPLES_DIR, 'missing'))).toBeUndefined();
    expect(await reader.readPackId(join(EXAMPLES_DIR, 'app-data'))).toBeUndefined();
  });
});

describe('thumbnails', () => {
  it('picks the first map by order that has a thumbnail', () => {
    const manifest = JSON.stringify({
      maps: [
        { order: 2, thumbnail: 'maps/b/thumb.webp' },
        { order: 1 },
        { order: 3, thumbnail: 'maps/c/thumb.webp' },
      ],
    });
    expect(thumbnailSourceFor(manifest)).toBe('maps/b/thumb.webp');
    expect(thumbnailSourceFor('{"maps": []}')).toBeUndefined();
    expect(thumbnailSourceFor('not json')).toBeUndefined();
  });

  it('copies the thumbnail and ignores failures', async () => {
    const copies: string[] = [];
    const cache = new PackThumbnailCache(new NodeAppFiles(), (source, packId) => {
      copies.push(`${packId} <- ${source}`);
      return Promise.resolve(`thumbnails/${packId}.webp`);
    });
    const entry = sampleLibraryEntry('dev.fogline.fixture', {
      path: join(FIXTURES_DIR, 'valid-pack'),
    });
    expect(await cache.cacheFor(entry)).toBe('thumbnails/dev.fogline.fixture.webp');
    expect(copies[0]).toMatch(/maps\/main\/thumbnail\.webp$/);

    const failing = new PackThumbnailCache(new NodeAppFiles(), () =>
      Promise.reject(new Error('disk full')),
    );
    expect(await failing.cacheFor(entry)).toBeUndefined();
    expect(await cache.cacheFor({ ...entry, path: join(EXAMPLES_DIR, 'nope') })).toBeUndefined();
  });
});

describe('system adapters', () => {
  it('reads the clock and generates valid unique ids', () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
    const a = randomIdGenerator.next();
    expect(a).toMatch(/^pin-[0-9a-f-]{36}$/);
    expect(randomIdGenerator.next()).not.toBe(a);
  });
});
