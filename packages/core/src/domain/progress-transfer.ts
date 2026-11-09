import type { ProgressExport } from '@fogline/pack-format';
import { createFilterState } from './filter';
import { deepFreeze } from './immutable';
import { findMap, hasMarker, type Pack } from './pack';
import { staleMarkerIds, type CustomMarker, type Progress } from './progress';

export type { ProgressExport };

export const PROGRESS_EXPORT_FORMAT_VERSION = 1;

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  readonly mode: ImportMode;
  /** The file was exported from a different pack version (a warning, not an error). */
  readonly packVersionDiffers: boolean;
  readonly fileVersion: string;
  readonly collectedImported: number;
  /** Collected marker ids in the file that this pack does not contain. Skipped. */
  readonly skippedMarkerIds: readonly string[];
  readonly customMarkersImported: number;
  /** Personal pins on maps this pack does not have. Skipped. */
  readonly skippedCustomMarkerIds: readonly string[];
}

/** Builds the export file content. Markers the pack no longer has are listed separately. */
export function buildProgressExport(progress: Progress, pack: Pack, now: string): ProgressExport {
  const missing = staleMarkerIds(progress, (id) => hasMarker(pack, id));
  const result: ProgressExport = {
    formatVersion: PROGRESS_EXPORT_FORMAT_VERSION,
    packId: pack.id,
    packVersion: pack.version,
    exportedAt: now,
    collected: { ...progress.collected },
    customMarkers: progress.customMarkers.map((marker) => ({ ...marker })),
    filters: {
      hiddenNodeIds: [...progress.filters.hiddenNodeIds],
      hideCollected: progress.filters.hideCollected,
    },
  };
  if (missing.length > 0) {
    result.markersNoLongerInPack = missing;
  }
  return result;
}

function newer(a: string, b: string): string {
  return Date.parse(b) > Date.parse(a) ? b : a;
}

/**
 * Applies an export file to the current progress (assumption A11).
 *
 * - merge: union of collected keeping the newest timestamp; union of personal pins by id with
 *   the file winning; filters unchanged.
 * - replace: collected, personal pins and filters come from the file.
 *
 * Entries the pack does not contain are skipped and reported. The caller must already have
 * checked that the file's pack id matches.
 */
export function importIntoProgress(
  current: Progress,
  incoming: ProgressExport,
  pack: Pack,
  mode: ImportMode,
  now: string,
): { progress: Progress; report: ImportReport } {
  const skippedMarkerIds: string[] = [];
  const acceptedCollected: Record<string, string> = {};
  for (const [markerId, at] of Object.entries(incoming.collected)) {
    if (hasMarker(pack, markerId)) {
      acceptedCollected[markerId] = at;
    } else {
      skippedMarkerIds.push(markerId);
    }
  }

  const skippedCustomMarkerIds: string[] = [];
  const acceptedCustom: CustomMarker[] = [];
  for (const marker of incoming.customMarkers) {
    if (findMap(pack, marker.map) === undefined) {
      skippedCustomMarkerIds.push(marker.id);
    } else {
      acceptedCustom.push(marker);
    }
  }

  let collected: Record<string, string>;
  let customMarkers: CustomMarker[];
  let filters = current.filters;
  if (mode === 'replace') {
    collected = acceptedCollected;
    customMarkers = acceptedCustom;
    filters = createFilterState(incoming.filters.hiddenNodeIds, incoming.filters.hideCollected);
  } else {
    collected = { ...current.collected };
    for (const [markerId, at] of Object.entries(acceptedCollected)) {
      const existing = collected[markerId];
      collected[markerId] = existing === undefined ? at : newer(existing, at);
    }
    const incomingIds = new Set(acceptedCustom.map((marker) => marker.id));
    customMarkers = [
      ...current.customMarkers.filter((marker) => !incomingIds.has(marker.id)),
      ...acceptedCustom,
    ];
  }

  const progress = deepFreeze({ ...current, collected, customMarkers, filters, updatedAt: now });
  return {
    progress,
    report: {
      mode,
      packVersionDiffers: incoming.packVersion !== pack.version,
      fileVersion: incoming.packVersion,
      collectedImported: Object.keys(acceptedCollected).length,
      skippedMarkerIds: skippedMarkerIds.sort(),
      customMarkersImported: acceptedCustom.length,
      skippedCustomMarkerIds: skippedCustomMarkerIds.sort(),
    },
  };
}
