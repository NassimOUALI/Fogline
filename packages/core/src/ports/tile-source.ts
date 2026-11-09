import type { GameMap } from '../domain/pack';

export interface TileCoordinate {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Serves tiles for one kind of tile storage (`tiles.type` in the manifest).
 * Adapters: `XyzFolderTileSource`, later `PmTilesTileSource`.
 */
export interface TileSource {
  supports(type: string): boolean;
  /** URL the renderer can load for one tile of `map`, in the pack at `packLocation`. */
  tileUrl(packLocation: string, map: GameMap, tile: TileCoordinate): string;
}

/** The first source that supports the map's tile type, or `undefined` (unsupported map). */
export function selectTileSource(
  sources: readonly TileSource[],
  map: GameMap,
): TileSource | undefined {
  return sources.find((source) => source.supports(map.tiles.type));
}
