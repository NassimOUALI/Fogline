import type { Size } from '../schemas/common';
import { joinRelativePath } from './pack-source';

/**
 * Tile geometry (assumption A10). `maxZoom` is the native zoom where the image is at full
 * resolution; at zoom `z` the image is scaled by `2^(z - maxZoom)`.
 */
export interface TileGrid {
  zoom: number;
  /** Scaled image size at this zoom, in pixels. */
  width: number;
  height: number;
  /** Number of tile columns and rows. */
  cols: number;
  rows: number;
}

export interface TileGeometryInput {
  size: Size;
  tileSize: number;
  maxZoom: number;
}

/** The zoom at which one tile covers at most `tileSize` pixels of the full image. */
export function nativeZoomFor(size: Size, tileSize: number): number {
  const largest = Math.max(size.width, size.height);
  return Math.max(0, Math.ceil(Math.log2(largest / tileSize)));
}

export function tileGridAt(map: TileGeometryInput, zoom: number): TileGrid {
  const scale = 2 ** (zoom - map.maxZoom);
  const width = Math.ceil(map.size.width * scale);
  const height = Math.ceil(map.size.height * scale);
  return {
    zoom,
    width,
    height,
    cols: Math.max(1, Math.ceil(width / map.tileSize)),
    rows: Math.max(1, Math.ceil(height / map.tileSize)),
  };
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

/** First, center and last tile of a grid: enough to catch a missing or truncated zoom level. */
export function sampleTileCoordinates(grid: TileGrid): TileCoordinate[] {
  const candidates: TileCoordinate[] = [
    { z: grid.zoom, x: 0, y: 0 },
    { z: grid.zoom, x: Math.floor((grid.cols - 1) / 2), y: Math.floor((grid.rows - 1) / 2) },
    { z: grid.zoom, x: grid.cols - 1, y: grid.rows - 1 },
  ];
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${String(c.x)},${String(c.y)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function tilePath(tilesFolder: string, tile: TileCoordinate, extension = 'webp'): string {
  return joinRelativePath(
    tilesFolder,
    String(tile.z),
    String(tile.x),
    `${String(tile.y)}.${extension}`,
  );
}
