import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validatePack, type CategoryNodeData, type Marker } from '@fogline/pack-format';
import { buildDemoContent, DEMO_MAPS } from '../src/demo/content';
import { generateDemoPack, type DemoSummary } from '../src/demo/generate';
import { SeededRandom } from '../src/demo/random';
import { createFolderPackSource, listFiles } from '../src/sources/folder-source';
import { cleanTempDirs, makeTempDir, run } from './helpers';

afterAll(cleanTempDirs);

let packDir: string;
let summary: DemoSummary;

beforeAll(async () => {
  packDir = join(await makeTempDir(), 'demo-pack');
  summary = await generateDemoPack(packDir, { markers: 60 });
});

function depth(nodes: readonly CategoryNodeData[]): number {
  return Math.max(0, ...nodes.map((node) => 1 + depth(node.children ?? [])));
}

describe('fogline-pack demo', () => {
  it('generates a pack that validates with no errors and no warnings', async () => {
    const result = await validatePack(createFolderPackSource(packDir));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('has two maps with multi-level xyz tiles and thumbnails', async () => {
    expect(summary.maps).toEqual([
      { id: 'surface', tiles: 129, maxZoom: 4 },
      { id: 'depths', tiles: 50, maxZoom: 3 },
    ]);
    for (const map of summary.maps) {
      const tiles = await listFiles(join(packDir, 'maps', map.id, 'tiles'));
      expect(tiles).toHaveLength(map.tiles);
      const zooms = new Set(tiles.map((tile) => tile.split('/')[0]));
      expect(zooms.size).toBe(map.maxZoom + 1);
      await stat(join(packDir, 'maps', map.id, 'thumbnail.webp'));
    }
  });

  it('has a nested category tree, icons, articles and markers with attributes', async () => {
    const categories = JSON.parse(
      await readFile(join(packDir, 'data', 'categories.json'), 'utf8'),
    ) as CategoryNodeData[];
    expect(depth(categories)).toBe(3);
    const surface = JSON.parse(
      await readFile(join(packDir, 'data', 'markers', 'surface.json'), 'utf8'),
    ) as Marker[];
    const depths = JSON.parse(
      await readFile(join(packDir, 'data', 'markers', 'depths.json'), 'utf8'),
    ) as Marker[];
    expect(surface.length + depths.length).toBe(60);
    expect(surface.length).toBe(42);
    expect(surface.some((marker) => (marker.attributes ?? []).length > 0)).toBe(true);
    for (const file of [
      'icons/chest.svg',
      'icons/star.svg',
      'icons/flag.svg',
      'data/articles/lost-tomes.md',
    ]) {
      await stat(join(packDir, file));
    }
  });

  it('refuses a non-empty folder unless --force replaces an existing demo pack', async () => {
    const result = await run('demo', packDir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('is not empty');

    const replaced = await run('demo', packDir, '--force', '--markers', '12');
    expect(replaced.code).toBe(0);
    expect(replaced.stdout).toContain('12 markers, 179 tiles in total.');
  });

  it('never deletes a folder that is not a demo pack', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'precious.txt'), 'keep me');
    const result = await run('demo', dir, '--force');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Nothing was deleted');
    expect(await readFile(join(dir, 'precious.txt'), 'utf8')).toBe('keep me');
  });
});

describe('demo content', () => {
  it('is identical for the same seed and differs for another seed', () => {
    expect(buildDemoContent({ seed: 7 })).toEqual(buildDemoContent({ seed: 7 }));
    expect(buildDemoContent({ seed: 7 }).markers).not.toEqual(
      buildDemoContent({ seed: 8 }).markers,
    );
  });

  it('scales to 20,000 markers with unique ids inside map bounds', () => {
    const content = buildDemoContent({ markers: 20000 });
    const all = Object.entries(content.markers).flatMap(([mapId, list]) =>
      list.map((marker) => ({ mapId, marker })),
    );
    expect(all).toHaveLength(20000);
    expect(new Set(all.map(({ marker }) => marker.id)).size).toBe(20000);
    for (const { mapId, marker } of all) {
      const map = DEMO_MAPS.find((candidate) => candidate.id === mapId);
      expect(marker.position.x).toBeGreaterThanOrEqual(0);
      expect(marker.position.x).toBeLessThanOrEqual(map?.width ?? 0);
      expect(marker.position.y).toBeLessThanOrEqual(map?.height ?? 0);
    }
  });

  it('keeps region labels apart', () => {
    const content = buildDemoContent();
    for (const map of DEMO_MAPS) {
      const regions = content.regions[map.id] ?? [];
      expect(regions).toHaveLength(map.regionCount);
      for (const a of regions) {
        for (const b of regions) {
          if (a !== b) {
            expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThan(200);
          }
        }
      }
    }
  });

  it('handles zero markers', () => {
    const content = buildDemoContent({ markers: 0 });
    expect(Object.values(content.markers).flat()).toEqual([]);
  });
});

describe('SeededRandom', () => {
  it('stays within ranges and picks by weight', () => {
    const random = new SeededRandom(42);
    for (let i = 0; i < 1000; i += 1) {
      const n = random.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 1000; i += 1) {
      const item = random.weighted([
        { key: 'heavy' as const, weight: 9 },
        { key: 'light' as const, weight: 1 },
      ]);
      counts[item.key] += 1;
    }
    expect(counts.heavy).toBeGreaterThan(counts.light * 4);
    expect(() => random.pick([])).toThrow('empty');
  });
});
