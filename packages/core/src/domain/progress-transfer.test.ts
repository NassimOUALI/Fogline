import { describe, expect, it } from 'vitest';
import { samplePack } from '../testing/sample-pack';
import { createFilterState } from './filter';
import {
  addCustomMarker,
  emptyProgress,
  setCollected,
  withFilters,
  type CustomMarker,
} from './progress';
import { buildProgressExport, importIntoProgress, type ProgressExport } from './progress-transfer';

const pack = samplePack({ version: '1.2.0' });
const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-02T10:00:00.000Z';
const T2 = '2026-11-03T10:00:00.000Z';

function pin(id: string, map = 'overworld', name = id): CustomMarker {
  return { id, map, position: { x: 1, y: 1 }, name, createdAt: T0 };
}

function exportFile(overrides: Partial<ProgressExport> = {}): ProgressExport {
  return {
    formatVersion: 1,
    packId: pack.id,
    packVersion: '1.2.0',
    exportedAt: T2,
    collected: {},
    customMarkers: [],
    filters: { hiddenNodeIds: [], hideCollected: false },
    ...overrides,
  };
}

describe('buildProgressExport', () => {
  it('copies progress and stamps pack id, version and time', () => {
    let progress = emptyProgress(pack.id, T0);
    progress = setCollected(progress, 'ow-chest-001', true, T0);
    progress = addCustomMarker(progress, pin('custom-0001'), T0);
    progress = withFilters(progress, createFilterState(['relics'], true), T0);
    const data = buildProgressExport(progress, pack, T1);
    expect(data).toEqual({
      formatVersion: 1,
      packId: pack.id,
      packVersion: '1.2.0',
      exportedAt: T1,
      collected: { 'ow-chest-001': T0 },
      customMarkers: [pin('custom-0001')],
      filters: { hiddenNodeIds: ['relics'], hideCollected: true },
    });
  });

  it('lists collected markers the pack no longer has', () => {
    const progress = setCollected(emptyProgress(pack.id, T0), 'gone-001', true, T0);
    expect(buildProgressExport(progress, pack, T1).markersNoLongerInPack).toEqual(['gone-001']);
  });
});

describe('importIntoProgress: merge', () => {
  let current = emptyProgress(pack.id, T0);
  current = setCollected(current, 'ow-chest-001', true, T1);
  current = setCollected(current, 'ow-relic-001', true, T1);
  current = addCustomMarker(current, pin('custom-0001', 'overworld', 'mine'), T0);
  current = withFilters(current, createFilterState(['waypoints']), T0);

  const incoming = exportFile({
    packVersion: '1.1.0',
    collected: {
      'ow-chest-001': T0, // older than ours: keep ours
      'ow-relic-001': T2, // newer: take it
      'cv-chest-001': T0, // new
      'gone-001': T0, // not in pack: skipped
    },
    customMarkers: [
      pin('custom-0001', 'overworld', 'theirs'), // same id: file wins
      pin('custom-0099', 'caves'),
      pin('custom-0100', 'moon'), // map not in pack: skipped
    ],
    filters: { hiddenNodeIds: ['relics'], hideCollected: true },
  });

  const { progress, report } = importIntoProgress(current, incoming, pack, 'merge', T2);

  it('unions collected markers keeping the newest timestamp', () => {
    expect(progress.collected).toEqual({
      'ow-chest-001': T1,
      'ow-relic-001': T2,
      'cv-chest-001': T0,
    });
  });

  it('unions personal pins by id with the file winning', () => {
    expect(progress.customMarkers.map((marker) => [marker.id, marker.name])).toEqual([
      ['custom-0001', 'theirs'],
      ['custom-0099', 'custom-0099'],
    ]);
  });

  it('keeps the current filters', () => {
    expect(progress.filters.hiddenNodeIds).toEqual(['waypoints']);
  });

  it('reports what was skipped and that the version differs', () => {
    expect(report).toEqual({
      mode: 'merge',
      packVersionDiffers: true,
      fileVersion: '1.1.0',
      collectedImported: 3,
      skippedMarkerIds: ['gone-001'],
      customMarkersImported: 2,
      skippedCustomMarkerIds: ['custom-0100'],
    });
    expect(progress.updatedAt).toBe(T2);
  });
});

describe('importIntoProgress: replace', () => {
  it('takes collected, pins and filters from the file, minus unknown entries', () => {
    let current = setCollected(emptyProgress(pack.id, T0), 'ow-chest-001', true, T0);
    current = addCustomMarker(current, pin('custom-0001'), T0);
    const { progress, report } = importIntoProgress(
      current,
      exportFile({
        collected: { 'cv-relic-001': T1, 'gone-001': T1 },
        customMarkers: [pin('custom-0050', 'caves')],
        filters: { hiddenNodeIds: ['relics', 'chest-rare'], hideCollected: true },
      }),
      pack,
      'replace',
      T2,
    );
    expect(progress.collected).toEqual({ 'cv-relic-001': T1 });
    expect(progress.customMarkers.map((marker) => marker.id)).toEqual(['custom-0050']);
    expect(progress.filters).toEqual({
      hiddenNodeIds: ['chest-rare', 'relics'],
      hideCollected: true,
    });
    expect(report.packVersionDiffers).toBe(false);
    expect(report.skippedMarkerIds).toEqual(['gone-001']);
  });
});
