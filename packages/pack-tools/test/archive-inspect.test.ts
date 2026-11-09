import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BROKEN_FIXTURES, FIXTURES_DIR, loadFixture } from '@fogline/pack-format/testing';
import type { PackSummary } from '../src/commands/inspect';
import { isInside, isStoredEntry } from '../src/commands/archive';
import { cleanTempDirs, makeTempDir, readZipDirectory, run, writeFileMap } from './helpers';

afterAll(cleanTempDirs);

const validDir = join(FIXTURES_DIR, 'valid-pack');

async function archiveValidFixture(): Promise<string> {
  const out = join(await makeTempDir(), 'fixture.fogpack');
  const result = await run('archive', validDir, out);
  expect(result.code).toBe(0);
  return out;
}

describe('fogline-pack archive', () => {
  it('writes a .fogpack with the manifest at the root, images stored and text deflated', async () => {
    const out = await archiveValidFixture();
    const entries = await readZipDirectory(out);
    const names = entries.map((entry) => entry.name);
    expect(names).toContain('manifest.json');
    expect(names).toContain('maps/main/tiles/1/1/1.webp');
    expect(names).toHaveLength(11);
    for (const entry of entries) {
      expect(entry.method, entry.name).toBe(entry.name.endsWith('.webp') ? 0 : 8);
    }
  });

  it('produces identical bytes for the same folder', async () => {
    const first = await readFile(await archiveValidFixture());
    const second = await readFile(await archiveValidFixture());
    expect(first.equals(second)).toBe(true);
  });

  it('round-trips: the archive validates and inspects like the folder', async () => {
    const out = await archiveValidFixture();
    const validation = await run('validate', out);
    expect(validation.code).toBe(0);
    expect(validation.stdout).toContain('Valid: 0 errors, 0 warnings.');
    const fromArchive = JSON.parse((await run('inspect', out, '--json')).stdout) as PackSummary;
    const fromFolder = JSON.parse((await run('inspect', validDir, '--json')).stdout) as PackSummary;
    expect(fromArchive.kind).toBe('archive');
    expect(fromArchive.sizeBytes).toBe((await stat(out)).size);
    expect({ ...fromArchive, kind: 'folder', path: validDir, sizeBytes: undefined }).toEqual({
      ...fromFolder,
      sizeBytes: undefined,
    });
  });

  it('refuses an invalid pack and writes nothing', async () => {
    const dir = await makeTempDir();
    const broken = BROKEN_FIXTURES.find((fixture) => fixture.name === 'tiles-missing');
    if (broken === undefined) {
      throw new Error('fixture missing');
    }
    await writeFileMap(join(dir, 'pack'), broken.build(loadFixture('valid-pack')));
    const out = join(dir, 'broken.fogpack');
    const result = await run('archive', join(dir, 'pack'), out);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('[tiles.missing]');
    expect(result.stderr).toContain('Archive not written');
    await expect(stat(out)).rejects.toThrow();
  });

  it('refuses to write inside the pack or to read a non-folder', async () => {
    const dir = await makeTempDir();
    await writeFileMap(dir, loadFixture('valid-pack'));
    const inside = await run('archive', dir, join(dir, 'self.fogpack'));
    expect(inside.code).toBe(1);
    expect(inside.stderr).toContain('outside the pack folder');
    const notFolder = await run(
      'archive',
      join(dir, 'manifest.json'),
      join(dir, '..', 'x.fogpack'),
    );
    expect(notFolder.code).toBe(1);
    expect(notFolder.stderr).toContain('Not a pack folder');
  });

  it('classifies entries and folders', () => {
    expect(isStoredEntry('maps/a/tiles/0/0/0.WEBP')).toBe(true);
    expect(isStoredEntry('maps/a/tiles.pmtiles')).toBe(true);
    expect(isStoredEntry('data/markers/a.json')).toBe(false);
    expect(isInside('/packs/a', '/packs/a/out.fogpack')).toBe(true);
    expect(isInside('/packs/a', '/packs/a.fogpack')).toBe(false);
    expect(isInside('/packs/a', '/packs/a')).toBe(false);
  });
});

describe('fogline-pack inspect', () => {
  it('summarizes a folder', async () => {
    const result = await run('inspect', validDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Fixture pack');
    expect(result.stdout).toContain('id        dev.fogline.fixture');
    expect(result.stdout).toContain('categories 1 groups, 3 leaves, depth 2');
    expect(result.stdout).toContain(
      'main "Main" 512x512px, zoom 0-1, xyz maps/main/tiles (5 files), 3 markers',
    );
  });

  it('reports structured data with --json', async () => {
    const summary = JSON.parse((await run('inspect', validDir, '--json')).stdout) as PackSummary;
    expect(summary).toMatchObject({
      kind: 'folder',
      id: 'dev.fogline.fixture',
      version: '1.0.0',
      license: 'CC0-1.0',
      markers: 3,
      files: 11,
      errors: 0,
      warnings: 0,
      categories: { groups: 1, leaves: 3, depth: 2 },
    });
  });

  it('mentions warnings and counts a pmtiles file', async () => {
    const dir = await makeTempDir();
    const files = loadFixture('valid-pack');
    const manifest = JSON.parse(String(files['manifest.json'])) as {
      maps: { tiles: { type: string; path: string }; maxZoom: number }[];
    };
    const map = manifest.maps[0];
    if (map === undefined) {
      throw new Error('no map');
    }
    map.tiles = { type: 'pmtiles', path: 'maps/main/tiles.pmtiles' };
    map.maxZoom = 3; // also triggers a zoom-mismatch warning
    await writeFileMap(dir, {
      ...files,
      'manifest.json': JSON.stringify(manifest),
      'maps/main/tiles.pmtiles': 'stub',
    });
    const result = await run('inspect', dir);
    expect(result.stdout).toContain('pmtiles maps/main/tiles.pmtiles (1 files)');
    expect(result.stdout).toContain('1 validation warning(s)');
  });

  it('explains packs it cannot read', async () => {
    const dir = await makeTempDir();
    await writeFileMap(dir, { 'manifest.json': '{ broken' });
    const unreadable = await run('inspect', dir);
    expect(unreadable.code).toBe(1);
    expect(unreadable.stderr).toContain('Cannot inspect');
    const corrupt = join(dir, 'corrupt.fogpack');
    await writeFile(corrupt, 'this is not a zip file at all');
    const notZip = await run('inspect', corrupt);
    expect(notZip.code).toBe(1);
    expect(notZip.stderr).toContain('is not a readable .fogpack archive');
  });
});
