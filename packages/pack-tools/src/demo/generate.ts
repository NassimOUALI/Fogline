import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { CliError } from '../io';
import { sliceImage, writeThumbnail } from '../imaging/slice';
import { DEMO_ICONS, mapArtworkSvg } from './artwork';
import {
  buildDemoContent,
  DEFAULT_DEMO_MARKERS,
  DEFAULT_DEMO_SEED,
  DEMO_MAPS,
  DEMO_PACK_ID,
  type DemoContentOptions,
} from './content';

export interface DemoOptions extends DemoContentOptions {
  /** Replace an existing demo pack in `outDir`. Never deletes anything else. */
  readonly force?: boolean | undefined;
}

export interface DemoSummary {
  readonly outDir: string;
  readonly markers: number;
  readonly maps: readonly {
    readonly id: string;
    readonly tiles: number;
    readonly maxZoom: number;
  }[];
  readonly tiles: number;
}

/** Folders and files the generator owns inside `outDir`. */
const GENERATED = ['manifest.json', 'data', 'icons', 'maps'];

async function prepareOutDir(outDir: string, force: boolean): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(outDir);
  } catch {
    await mkdir(outDir, { recursive: true });
    return;
  }
  if (entries.length === 0) {
    return;
  }
  if (!force) {
    throw new CliError(
      `${outDir} is not empty. Choose an empty folder, or pass --force to replace an existing demo pack.`,
    );
  }
  let existingId: unknown;
  try {
    existingId = (
      JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8')) as { id?: unknown }
    ).id;
  } catch {
    existingId = undefined;
  }
  if (existingId !== DEMO_PACK_ID) {
    throw new CliError(
      `--force only replaces a demo pack, and ${outDir} does not contain one. Nothing was deleted.`,
    );
  }
  for (const name of GENERATED) {
    await rm(join(outDir, name), { recursive: true, force: true });
  }
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Writes a complete, valid demo pack with procedurally generated imagery. */
export async function generateDemoPack(
  outDir: string,
  options: DemoOptions = {},
): Promise<DemoSummary> {
  const markerCount = options.markers ?? DEFAULT_DEMO_MARKERS;
  const seed = options.seed ?? DEFAULT_DEMO_SEED;
  if (!Number.isInteger(markerCount) || markerCount < 0) {
    throw new CliError('--markers must be a whole number of 0 or more.');
  }
  await prepareOutDir(outDir, options.force === true);

  const content = buildDemoContent({ markers: markerCount, seed });
  await writeText(join(outDir, 'manifest.json'), json(content.manifest));
  await writeText(join(outDir, content.manifest.categories), json(content.categories));
  for (const [mapId, path] of Object.entries(content.manifest.markers)) {
    await writeText(join(outDir, path), json(content.markers[mapId] ?? []));
  }
  for (const [id, text] of Object.entries(content.articles)) {
    await writeText(join(outDir, 'data', 'articles', `${id}.md`), text);
  }
  for (const [path, svg] of Object.entries(DEMO_ICONS)) {
    await writeText(join(outDir, path), svg);
  }

  const maps: { id: string; tiles: number; maxZoom: number }[] = [];
  for (const [index, map] of DEMO_MAPS.entries()) {
    const svg = mapArtworkSvg(map, content.regions[map.id] ?? [], seed * 101 + index);
    const image = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer();
    const mapDir = join(outDir, 'maps', map.id);
    const sliced = await sliceImage(image, join(mapDir, 'tiles'), { tileSize: 256 });
    await writeThumbnail(image, join(mapDir, 'thumbnail.webp'));
    maps.push({ id: map.id, tiles: sliced.tileCount, maxZoom: sliced.maxZoom });
  }

  return {
    outDir,
    markers: markerCount,
    maps,
    tiles: maps.reduce((sum, map) => sum + map.tiles, 0),
  };
}
