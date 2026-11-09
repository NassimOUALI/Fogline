import type { GameMap, Position } from '../domain/pack';
import type { TileCoordinate } from './tile-source';

export interface Viewport {
  /** Center in map pixel space. */
  readonly center: Position;
  readonly zoom: number;
}

/** One pin as the renderer draws it: one shape for every game; color and icon vary. */
export interface RenderMarker {
  readonly id: string;
  readonly kind: 'pack' | 'personal';
  readonly position: Position;
  readonly label: string;
  readonly color: string;
  readonly icon?: string | undefined;
  /** Collected markers are drawn dimmed. */
  readonly dimmed: boolean;
}

export type MapEvent =
  | { readonly type: 'click'; readonly position: Position }
  | { readonly type: 'contextmenu'; readonly position: Position }
  | { readonly type: 'markerclick'; readonly markerId: string }
  | { readonly type: 'viewportchange'; readonly viewport: Viewport };

export interface ShowMapInput {
  readonly map: GameMap;
  readonly tileUrl: (tile: TileCoordinate) => string;
  /** Color behind and around the tiles. */
  readonly backdrop: string;
  readonly viewport?: Viewport | undefined;
}

/**
 * Draws a map, its markers and the viewport, and reports user interaction. Implemented with
 * Leaflet (`CRS.Simple`) in the desktop app; replaceable by MapLibre or OpenLayers.
 */
export interface MapRenderer {
  showMap(input: ShowMapInput): void;
  /** Replaces all markers in one batch. */
  setMarkers(markers: readonly RenderMarker[]): void;
  setViewport(viewport: Viewport, options?: { readonly animate?: boolean }): void;
  getViewport(): Viewport | undefined;
  /** Highlights one marker (for search results), or clears the highlight. */
  highlight(markerId: string | undefined): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: (event: MapEvent) => void): () => void;
  destroy(): void;
}
