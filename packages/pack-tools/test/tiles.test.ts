import { readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validatePack, type MapEntry } from '@fogline/pack-format';
import { defaultPackRoot } from '../src/commands/tiles';
import { listFiles, createFolderPackSource } from '../src/sources/folder-source';
import { cleanTempDirs, makeTempDir, run, writeFileMap } from './helpers';

afterAll(cleanTempDirs);

let image: string;

beforeAll(async () => {
  const dir = await makeTempDir();
  image = join(dir, 'world.png');
  // 700x300 horizontal gradient: red grows left to right.
  const width = 700;
  const height = 300;
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      pixels[i] = Math.round((x / width) * 255);
      pixels[i + 1] = 80;
      pixels[i + 2] = 120;
    }
  }
  await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toFile(image);
});

describe('fogline-pack tiles', () => {
  it('slices an image into an xyz pyramid and prints a correct map entry', async () => {
    const pack = await makeTempDir();
    const outDir = join(pack, 'maps', 'world');
    const result = await run('tiles', image, outDir, '--name', 'World');
    expect(result.code).toBe(0);
    const entry = JSON.parse(result.stdout) as MapEntry;
    expect(entry).toEqual({
      id: 'world',
      name: 'World',
      order: 1,
      size: { width: 700, height: 300 },
      tileSize: 256,
      minZoom: 0,
      maxZoom: 2,
      tiles: { type: 'xyz', path: 'maps/world/tiles' },
      thumbnail: 'maps/world/thumbnail.webp',
    });
    expect(JSON.parse(await readFile(join(outDir, 'map-entry.json'), 'utf8'))).toEqual(entry);
    expect(result.stderr).toContain('into 9 webp tiles, zoom 0-2');

    // z2: 700x300 -> 3x2 tiles; z1: 350x150 -> 2x1; z0: 175x75 -> 1x1.
    const tiles = (await listFiles(join(outDir, 'tiles'))).sort();
    expect(tiles).toEqual([
      '0/0/0.webp',
      '1/0/0.webp',
      '1/1/0.webp',
      '2/0/0.webp',
      '2/0/1.webp',
      '2/1/0.webp',
      '2/1/1.webp',
      '2/2/0.webp',
      '2/2/1.webp',
    ]);
    await stat(join(outDir, 'thumbnail.webp'));
  });

  it('pads edge tiles with transparency to the full tile size', async () => {
    const pack = await makeTempDir();
    const outDir = join(pack, 'maps', 'world');
    await run('tiles', image, outDir);
    // Tile x=2 at z2 covers pixels 512..699: 188 image columns, then padding.
    const edge = join(outDir, 'tiles', '2', '2', '0.webp');
    const meta = await sharp(edge).metadata();
    expect([meta.width, meta.height]).toEqual([256, 256]);
    const { data, info } = await sharp(edge)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number): number | undefined =>
      data[(y * info.width + x) * 4 + 3];
    expect(alphaAt(100, 10)).toBe(255);
    expect(alphaAt(250, 10)).toBe(0);
    // The left half of the image is darker red than the right half.
    const left = await sharp(join(outDir, 'tiles', '2', '0', '0.webp'))
      .raw()
      .toBuffer();
    const right = await sharp(join(outDir, 'tiles', '2', '1', '0.webp'))
      .raw()
      .toBuffer();
    expect(left[0]).toBeLessThan(right[0] ?? 0);
  });

  it('produces an entry that validates inside a pack', async () => {
    const pack = await makeTempDir();
    const result = await run('tiles', image, join(pack, 'maps', 'world'));
    const entry = JSON.parse(result.stdout) as MapEntry;
    await writeFileMap(pack, {
      'manifest.json': JSON.stringify({
        formatVersion: 1,
        id: 'dev.fogline.tiles-test',
        game: { name: 'Tiles test' },
        title: 'Tiles test',
        version: '1.0.0',
        authors: [{ name: 'tests' }],
        license: { spdx: 'CC0-1.0' },
        defaultLanguage: 'en',
        maps: [entry],
        categories: 'data/categories.json',
        markers: { world: 'data/markers/world.json' },
      }),
      'data/categories.json': JSON.stringify([{ id: 'spot', name: 'Spot' }]),
      'data/markers/world.json': JSON.stringify([
        { id: 'a', category: 'spot', position: { x: 699, y: 299 }, name: 'Corner' },
      ]),
    });
    const validation = await validatePack(createFolderPackSource(pack));
    expect(validation.issues).toEqual([]);
  });

  it('supports png, an explicit id, tile size and pack root', async () => {
    const dir = await makeTempDir();
    const outDir = join(dir, 'out');
    const result = await run(
      'tiles',
      image,
      outDir,
      '--id',
      'big',
      '--format',
      'png',
      '--tile-size',
      '512',
      '--order',
      '3',
      '--pack-root',
      dir,
    );
    expect(result.code).toBe(0);
    const entry = JSON.parse(result.stdout) as MapEntry;
    expect(entry).toMatchObject({
      id: 'big',
      order: 3,
      tileSize: 512,
      maxZoom: 1,
      tiles: { path: 'out/tiles' },
    });
    expect(result.stderr).toContain('--tile-extension png');
    expect(await listFiles(join(outDir, 'tiles'))).toEqual(['0/0/0.png', '1/0/0.png', '1/1/0.png']);
  });

  it('derives the pack root from the documented maps/<id> layout', () => {
    const packRoot = resolve('packs', 'demo');
    expect(defaultPackRoot(join(packRoot, 'maps', 'world'))).toBe(packRoot);
    const elsewhere = resolve('somewhere', 'out');
    expect(defaultPackRoot(elsewhere)).toBe(elsewhere);
  });

  it('explains missing images, unreadable images and paths outside the pack', async () => {
    const dir = await makeTempDir();
    const missing = await run('tiles', join(dir, 'nope.png'), join(dir, 'out'));
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('Image not found');

    const bogus = join(dir, 'bogus.png');
    await writeFile(bogus, 'not an image');
    const unreadable = await run('tiles', bogus, join(dir, 'out'));
    expect(unreadable.code).toBe(1);
    expect(unreadable.stderr).toContain('Could not read');

    const outside = await run(
      'tiles',
      image,
      join(dir, 'out'),
      '--pack-root',
      join(dir, 'elsewhere'),
    );
    expect(outside.code).toBe(1);
    expect(outside.stderr).toContain('is outside the pack folder');
  });
});
