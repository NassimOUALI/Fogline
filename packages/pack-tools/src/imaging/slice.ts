import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { nativeZoomFor, tileGridAt, type Size } from '@fogline/pack-format';

export type TileFormat = 'webp' | 'png';

export interface SliceOptions {
  /** Default 256. */
  readonly tileSize?: number | undefined;
  /** Default `webp`. */
  readonly format?: TileFormat | undefined;
  /** WebP quality, 1-100. Default 90. */
  readonly quality?: number | undefined;
  /** Default 0. */
  readonly minZoom?: number | undefined;
}

export interface SliceResult {
  readonly size: Size;
  readonly tileSize: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly format: TileFormat;
  /** Number of tiles written per zoom level, indexed by zoom. */
  readonly tilesPerZoom: Readonly<Record<number, number>>;
  readonly tileCount: number;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Tiles encoded concurrently; bounded so huge levels do not exhaust memory. */
const CONCURRENCY = 8;

async function inBatches<T>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run));
  }
}

/**
 * Slices an image into an `xyz` pyramid under `tilesDir/{z}/{x}/{y}.{format}`.
 *
 * Geometry (assumption A10): `maxZoom` is the native zoom where one tile pixel is one image
 * pixel; each lower zoom halves the image. Edge tiles are padded with transparency to the full
 * tile size, so every tile file has the same dimensions.
 */
export async function sliceImage(
  input: string | Buffer,
  tilesDir: string,
  options: SliceOptions = {},
): Promise<SliceResult> {
  const tileSize = options.tileSize ?? 256;
  const format = options.format ?? 'webp';
  const quality = options.quality ?? 90;
  const metadata = await sharp(input, { limitInputPixels: false }).autoOrient().metadata();
  const width = metadata.autoOrient.width;
  const height = metadata.autoOrient.height;
  const size = { width, height };
  const maxZoom = nativeZoomFor(size, tileSize);
  const minZoom = Math.min(options.minZoom ?? 0, maxZoom);

  const tilesPerZoom: Record<number, number> = {};
  let tileCount = 0;
  for (let zoom = maxZoom; zoom >= minZoom; zoom -= 1) {
    const grid = tileGridAt({ size, tileSize, maxZoom }, zoom);
    const level = await sharp(input, { limitInputPixels: false })
      .autoOrient()
      .resize(grid.width, grid.height, { fit: 'fill', kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const raw = { width: level.info.width, height: level.info.height, channels: 4 as const };

    const tiles: { x: number; y: number }[] = [];
    for (let x = 0; x < grid.cols; x += 1) {
      await mkdir(join(tilesDir, String(zoom), String(x)), { recursive: true });
      for (let y = 0; y < grid.rows; y += 1) {
        tiles.push({ x, y });
      }
    }
    await inBatches(tiles, CONCURRENCY, async ({ x, y }) => {
      const left = x * tileSize;
      const top = y * tileSize;
      const tileWidth = Math.min(tileSize, raw.width - left);
      const tileHeight = Math.min(tileSize, raw.height - top);
      const tile = sharp(level.data, { raw })
        .extract({ left, top, width: tileWidth, height: tileHeight })
        .extend({
          right: tileSize - tileWidth,
          bottom: tileSize - tileHeight,
          background: TRANSPARENT,
        });
      const encoded = format === 'webp' ? tile.webp({ quality }) : tile.png();
      await encoded.toFile(join(tilesDir, String(zoom), String(x), `${String(y)}.${format}`));
    });
    tilesPerZoom[zoom] = tiles.length;
    tileCount += tiles.length;
  }
  return { size, tileSize, minZoom, maxZoom, format, tilesPerZoom, tileCount };
}

/** A small preview for library cards, at most `maxWidth` wide. */
export async function writeThumbnail(
  input: string | Buffer,
  outFile: string,
  maxWidth = 320,
): Promise<void> {
  await sharp(input, { limitInputPixels: false })
    .autoOrient()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outFile);
}
