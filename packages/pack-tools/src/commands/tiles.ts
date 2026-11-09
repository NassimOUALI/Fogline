import { stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { MapEntry } from '@fogline/pack-format';
import { CliError, EXIT_OK, type CliIO } from '../io';
import { sliceImage, writeThumbnail, type TileFormat } from '../imaging/slice';

export interface TilesOptions {
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly tileSize?: number | undefined;
  readonly format?: TileFormat | undefined;
  readonly quality?: number | undefined;
  readonly minZoom?: number | undefined;
  readonly order?: number | undefined;
  /** Pack folder the manifest paths are relative to; see `defaultPackRoot`. */
  readonly packRoot?: string | undefined;
}

export const MAP_ENTRY_FILE = 'map-entry.json';

/**
 * `<pack>/maps/<id>` is the documented layout, so the pack root is two levels up when the parent
 * folder is named `maps`. Otherwise paths are relative to `outDir` itself.
 */
export function defaultPackRoot(outDir: string): string {
  const parent = dirname(resolve(outDir));
  return basename(parent) === 'maps' ? dirname(parent) : resolve(outDir);
}

function toPackPath(packRoot: string, path: string): string {
  const rel = relative(resolve(packRoot), resolve(path));
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new CliError(`${path} is outside the pack folder ${packRoot}; pass --pack-root.`);
  }
  return rel.split(sep).join('/');
}

/**
 * `fogline-pack tiles <image> <outDir>`: slices an image into `<outDir>/tiles`, writes a
 * thumbnail and `map-entry.json`, and prints the manifest map entry.
 */
export async function runTiles(
  io: CliIO,
  image: string,
  outDir: string,
  options: TilesOptions = {},
): Promise<number> {
  try {
    await stat(image);
  } catch {
    throw new CliError(`Image not found: ${image}`);
  }
  const id = options.id ?? basename(resolve(outDir));
  const packRoot = options.packRoot ?? defaultPackRoot(outDir);
  const tilesDir = join(outDir, 'tiles');
  const thumbnail = join(outDir, 'thumbnail.webp');
  const tilesPath = toPackPath(packRoot, tilesDir);

  let sliced;
  try {
    sliced = await sliceImage(image, tilesDir, options);
    await writeThumbnail(image, thumbnail);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliError(`Could not read ${image} as an image: ${detail}`);
  }

  const entry: MapEntry = {
    id,
    name: options.name ?? id,
    order: options.order ?? 1,
    size: sliced.size,
    tileSize: sliced.tileSize,
    minZoom: sliced.minZoom,
    maxZoom: sliced.maxZoom,
    tiles: { type: 'xyz', path: tilesPath },
    thumbnail: toPackPath(packRoot, thumbnail),
  };
  const json = JSON.stringify(entry, null, 2);
  await writeFile(join(outDir, MAP_ENTRY_FILE), `${json}\n`);

  io.err(
    `Sliced ${String(sliced.size.width)}x${String(sliced.size.height)} into ${String(sliced.tileCount)} ${sliced.format} tiles, zoom ${String(sliced.minZoom)}-${String(sliced.maxZoom)}.`,
  );
  io.err(`Add this entry to manifest.maps (also saved to ${join(outDir, MAP_ENTRY_FILE)}):`);
  io.out(json);
  if (sliced.format !== 'webp') {
    io.err(`Validate with --tile-extension ${sliced.format}.`);
  }
  return EXIT_OK;
}
