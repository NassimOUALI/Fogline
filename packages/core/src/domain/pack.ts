import type {
  Author,
  CategoryNodeData,
  License,
  LocalizedText,
  MarkerAttribute,
  Palette,
  ParsedPack,
  Position,
  Size,
  Tiles,
} from '@fogline/pack-format';
import { deepFreeze } from './immutable';
import { localize } from './localized-text';

export type { CategoryNodeData, MarkerAttribute, Position };

/** One map of a pack (surface, underground, ...). */
export interface GameMap {
  readonly id: string;
  readonly name: LocalizedText;
  readonly order: number;
  /** Source image size at full resolution; markers use this pixel space. */
  readonly size: Size;
  readonly tileSize: number;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly tiles: Tiles;
  readonly thumbnail?: string | undefined;
}

/** A marker from a pack. Markers are a flat list that references leaf categories. */
export interface Marker {
  readonly id: string;
  readonly mapId: string;
  readonly categoryId: string;
  readonly position: Position;
  readonly name: LocalizedText;
  readonly description?: LocalizedText | undefined;
  readonly attributes: readonly MarkerAttribute[];
  readonly articleId?: string | undefined;
  /** Reserved for future facets; ignored in v1. */
  readonly tags: readonly string[];
}

/** A loaded, validated pack. Plain frozen data; look-ups go through the helpers below. */
export interface Pack {
  readonly id: string;
  readonly version: string;
  readonly title: LocalizedText;
  readonly description?: LocalizedText | undefined;
  readonly game: { readonly name: string; readonly publisher?: string | undefined };
  readonly defaultLanguage: string;
  readonly authors: readonly Author[];
  readonly license: License;
  readonly attribution: readonly string[];
  readonly palette?: Palette | undefined;
  /** Sorted by `order`. */
  readonly maps: readonly GameMap[];
  readonly categories: readonly CategoryNodeData[];
  /** All markers of all maps, grouped by map in map order. */
  readonly markers: readonly Marker[];
}

/** Builds the domain pack from the data the pack-format validator returns. */
export function createPack(data: ParsedPack): Pack {
  const copy = structuredClone(data);
  const { manifest } = copy;
  const maps: GameMap[] = [...manifest.maps]
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((map) => ({
      id: map.id,
      name: map.name,
      order: map.order,
      size: map.size,
      tileSize: map.tileSize,
      minZoom: map.minZoom,
      maxZoom: map.maxZoom,
      tiles: map.tiles,
      thumbnail: map.thumbnail,
    }));

  const markers: Marker[] = [];
  for (const map of maps) {
    for (const marker of copy.markers[map.id] ?? []) {
      markers.push({
        id: marker.id,
        mapId: map.id,
        categoryId: marker.category,
        position: marker.position,
        name: marker.name,
        description: marker.description,
        attributes: marker.attributes ?? [],
        articleId: marker.article,
        tags: marker.tags ?? [],
      });
    }
  }

  return deepFreeze({
    id: manifest.id,
    version: manifest.version,
    title: manifest.title,
    description: manifest.description,
    game: manifest.game,
    defaultLanguage: manifest.defaultLanguage,
    authors: manifest.authors,
    license: manifest.license,
    attribution: manifest.attribution ?? [],
    palette: manifest.theme?.palette,
    maps,
    categories: copy.categories,
    markers,
  });
}

interface PackIndex {
  readonly markersById: ReadonlyMap<string, Marker>;
  readonly markersByMap: ReadonlyMap<string, readonly Marker[]>;
  readonly mapsById: ReadonlyMap<string, GameMap>;
}

const indexes = new WeakMap<Pack, PackIndex>();

/** Look-up tables built once per pack and cached; the pack itself stays plain data. */
function indexOf(pack: Pack): PackIndex {
  const cached = indexes.get(pack);
  if (cached !== undefined) {
    return cached;
  }
  const markersByMap = new Map<string, Marker[]>(pack.maps.map((map) => [map.id, []]));
  for (const marker of pack.markers) {
    markersByMap.get(marker.mapId)?.push(marker);
  }
  const index: PackIndex = {
    markersById: new Map(pack.markers.map((marker) => [marker.id, marker])),
    markersByMap,
    mapsById: new Map(pack.maps.map((map) => [map.id, map])),
  };
  indexes.set(pack, index);
  return index;
}

export function findMap(pack: Pack, mapId: string): GameMap | undefined {
  return indexOf(pack).mapsById.get(mapId);
}

export function findMarker(pack: Pack, markerId: string): Marker | undefined {
  return indexOf(pack).markersById.get(markerId);
}

export function hasMarker(pack: Pack, markerId: string): boolean {
  return indexOf(pack).markersById.has(markerId);
}

export function markersOnMap(pack: Pack, mapId: string): readonly Marker[] {
  return indexOf(pack).markersByMap.get(mapId) ?? [];
}

/** The pack title in `language`, falling back to the pack's default language. */
export function packTitle(pack: Pack, language: string = pack.defaultLanguage): string {
  return localize(pack.title, language, pack.defaultLanguage);
}

/** True when `position` lies inside the map's pixel bounds. */
export function isInsideMap(map: GameMap, position: Position): boolean {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x <= map.size.width &&
    position.y <= map.size.height
  );
}
