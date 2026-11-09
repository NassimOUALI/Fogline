import { describe, expect, it } from 'vitest';
import { sampleLibraryEntry } from '@fogline/core/testing';
import { createTestPlatform } from '../test/test-services';
import { parseProgressExport } from './progress-file';
import { regrantLibraryAccess } from './services';

describe('regrantLibraryAccess', () => {
  it('grants access to every library folder that still exists', async () => {
    const platform = createTestPlatform({
      entries: [
        sampleLibraryEntry('a', { path: 'D:/packs/a' }),
        sampleLibraryEntry('b', { path: 'E:/unplugged/b' }),
      ],
    });
    platform.files.addPath('D:/packs/a');
    expect(await regrantLibraryAccess(platform.services.ports)).toBe(1);
    expect(platform.files.granted).toEqual(['D:/packs/a']);
  });

  it('keeps going when one grant fails', async () => {
    const platform = createTestPlatform({
      entries: [
        sampleLibraryEntry('a', { path: 'D:/a' }),
        sampleLibraryEntry('b', { path: 'D:/b' }),
      ],
    });
    platform.files.addPath('D:/a', 'D:/b');
    const ports = {
      library: platform.library,
      files: Object.assign(Object.create(platform.files) as typeof platform.files, {
        grantAccess: (path: string) =>
          path === 'D:/a' ? Promise.reject(new Error('denied')) : Promise.resolve(),
      }),
    };
    expect(await regrantLibraryAccess(ports)).toBe(1);
  });
});

describe('parseProgressExport', () => {
  const valid = {
    formatVersion: 1,
    packId: 'com.example.game',
    packVersion: '1.0.0',
    exportedAt: '2026-11-09T12:00:00Z',
    collected: { a: '2026-11-09T12:00:00Z' },
  };

  it('accepts an export file and fills defaults', () => {
    const result = parseProgressExport(JSON.stringify(valid));
    expect(result.ok && result.data.customMarkers).toEqual([]);
  });

  it('explains files that are not exports', () => {
    const notJson = parseProgressExport('nope');
    expect(notJson.ok ? '' : notJson.message).toContain('not valid JSON');
    const wrongShape = parseProgressExport(JSON.stringify({ ...valid, packId: 42 }));
    expect(wrongShape.ok ? '' : wrongShape.message).toContain('packId');
    const empty = parseProgressExport('[]');
    expect(empty.ok).toBe(false);
  });
});
