import type { Position } from '@fogline/pack-format';
import { createFilterState, EMPTY_FILTER, type FilterState } from './filter';
import { deepFreeze } from './immutable';

/** A personal pin. Field names match the progress file format. */
export interface CustomMarker {
  readonly id: string;
  /** Map id. */
  readonly map: string;
  readonly position: Position;
  readonly name: string;
  readonly note?: string | undefined;
  readonly createdAt: string;
}

export interface LastView {
  readonly map: string;
  readonly center: Position;
  readonly zoom: number;
}

/**
 * One pack's user data, keyed by pack id and stored outside the pack.
 * Marker ids are stable across pack versions, so collected ids survive updates; ids the pack
 * no longer contains stay here and are simply ignored by counts.
 */
export interface Progress {
  readonly packId: string;
  readonly packVersionSeen?: string | undefined;
  readonly updatedAt: string;
  /** `markerId -> collectedAt` */
  readonly collected: Readonly<Record<string, string>>;
  readonly customMarkers: readonly CustomMarker[];
  readonly filters: FilterState;
  readonly lastView?: LastView | undefined;
}

export interface ProgressSummary {
  readonly collected: number;
  readonly customMarkers: number;
  readonly hiddenCategories: number;
}

export interface CustomMarkerChanges {
  readonly name?: string | undefined;
  readonly note?: string | undefined;
  readonly position?: Position | undefined;
}

function update(progress: Progress, changes: Partial<Progress>, now: string): Progress {
  return deepFreeze({ ...progress, ...changes, updatedAt: now });
}

export function emptyProgress(packId: string, now: string): Progress {
  return deepFreeze({
    packId,
    updatedAt: now,
    collected: {},
    customMarkers: [],
    filters: EMPTY_FILTER,
  });
}

export function isCollected(progress: Progress, markerId: string): boolean {
  return Object.hasOwn(progress.collected, markerId);
}

export function collectedAt(progress: Progress, markerId: string): string | undefined {
  return isCollected(progress, markerId) ? progress.collected[markerId] : undefined;
}

export function setCollected(
  progress: Progress,
  markerId: string,
  collected: boolean,
  now: string,
): Progress {
  if (collected === isCollected(progress, markerId)) {
    return progress;
  }
  const next = Object.fromEntries(
    Object.entries(progress.collected).filter(([id]) => id !== markerId),
  );
  if (collected) {
    next[markerId] = now;
  }
  return update(progress, { collected: next }, now);
}

export function toggleCollected(progress: Progress, markerId: string, now: string): Progress {
  return setCollected(progress, markerId, !isCollected(progress, markerId), now);
}

export function findCustomMarker(progress: Progress, id: string): CustomMarker | undefined {
  return progress.customMarkers.find((marker) => marker.id === id);
}

export function addCustomMarker(progress: Progress, marker: CustomMarker, now: string): Progress {
  return update(progress, { customMarkers: [...progress.customMarkers, marker] }, now);
}

/** Returns `undefined` when no personal marker has `id`. */
export function updateCustomMarker(
  progress: Progress,
  id: string,
  changes: CustomMarkerChanges,
  now: string,
): Progress | undefined {
  const existing = findCustomMarker(progress, id);
  if (existing === undefined) {
    return undefined;
  }
  const changed: CustomMarker = {
    ...existing,
    ...(changes.name === undefined ? {} : { name: changes.name }),
    ...(changes.note === undefined ? {} : { note: changes.note }),
    ...(changes.position === undefined ? {} : { position: changes.position }),
  };
  return update(
    progress,
    {
      customMarkers: progress.customMarkers.map((marker) => (marker.id === id ? changed : marker)),
    },
    now,
  );
}

/** Returns `undefined` when no personal marker has `id`. */
export function removeCustomMarker(
  progress: Progress,
  id: string,
  now: string,
): Progress | undefined {
  if (findCustomMarker(progress, id) === undefined) {
    return undefined;
  }
  return update(
    progress,
    { customMarkers: progress.customMarkers.filter((marker) => marker.id !== id) },
    now,
  );
}

export function withFilters(progress: Progress, filters: FilterState, now: string): Progress {
  return update(
    progress,
    { filters: createFilterState(filters.hiddenNodeIds, filters.hideCollected) },
    now,
  );
}

export function withLastView(progress: Progress, lastView: LastView, now: string): Progress {
  return update(progress, { lastView }, now);
}

export function withPackVersionSeen(progress: Progress, version: string, now: string): Progress {
  return update(progress, { packVersionSeen: version }, now);
}

/**
 * Clears collected markers, personal pins and filters. Keeps the pack id, the last pack
 * version seen and the last view, which are bookkeeping rather than progress.
 */
export function resetProgress(progress: Progress, now: string): Progress {
  return update(progress, { collected: {}, customMarkers: [], filters: EMPTY_FILTER }, now);
}

export function summarizeProgress(progress: Progress): ProgressSummary {
  return {
    collected: Object.keys(progress.collected).length,
    customMarkers: progress.customMarkers.length,
    hiddenCategories: progress.filters.hiddenNodeIds.length,
  };
}

/** Collected ids that `isKnownMarker` does not recognize (removed by a pack update). */
export function staleMarkerIds(
  progress: Progress,
  isKnownMarker: (markerId: string) => boolean,
): string[] {
  return Object.keys(progress.collected)
    .filter((id) => !isKnownMarker(id))
    .sort();
}
