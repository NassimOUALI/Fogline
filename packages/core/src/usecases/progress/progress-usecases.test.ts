import { describe, expect, it } from 'vitest';
import { createFilterState } from '../../domain/filter';
import { sampleProgressRecord } from '../../testing/contracts';
import { FixedClock, SequentialIdGenerator } from '../../testing/in-memory-io';
import { InMemoryProgressStore } from '../../testing/in-memory-stores';
import { samplePack } from '../../testing/sample-pack';
import { AddPersonalMarker, RemovePersonalMarker, UpdatePersonalMarker } from './personal-markers';
import { ResetProgress } from './reset-progress';
import { SaveFilterState, SaveLastView } from './save-view-state';
import { ToggleCollected } from './toggle-collected';
import { ExportProgress, ImportProgress } from './transfer-progress';

const NOW = '2026-11-09T12:00:00.000Z';
const pack = samplePack();

function setup() {
  const progress = new InMemoryProgressStore();
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  return {
    progress,
    clock,
    toggle: new ToggleCollected({ progress, clock }),
    addPin: new AddPersonalMarker({ progress, clock, ids }),
    updatePin: new UpdatePersonalMarker({ progress, clock }),
    removePin: new RemovePersonalMarker({ progress, clock }),
    saveFilter: new SaveFilterState({ progress, clock }),
    saveView: new SaveLastView({ progress, clock }),
    reset: new ResetProgress({ progress, clock }),
    exportProgress: new ExportProgress({ progress, clock }),
    importProgress: new ImportProgress({ progress, clock }),
  };
}

describe('ToggleCollected', () => {
  it('marks and unmarks a marker and persists it', async () => {
    const s = setup();
    const on = await s.toggle.execute({ pack, markerId: 'ow-chest-001' });
    expect(on.ok && on.value.collected).toBe(true);
    expect((await s.progress.load(pack.id))?.collected).toEqual({ 'ow-chest-001': NOW });
    const off = await s.toggle.execute({ pack, markerId: 'ow-chest-001' });
    expect(off.ok && off.value.collected).toBe(false);
    expect((await s.progress.load(pack.id))?.collected).toEqual({});
  });

  it('sets an explicit value and skips the write when nothing changes', async () => {
    const s = setup();
    await s.toggle.execute({ pack, markerId: 'ow-chest-001', collected: true });
    const saves = s.progress.saves;
    const again = await s.toggle.execute({ pack, markerId: 'ow-chest-001', collected: true });
    expect(again.ok && again.value.collected).toBe(true);
    expect(s.progress.saves).toBe(saves);
  });

  it('refuses markers that are not in the pack', async () => {
    const s = setup();
    const result = await s.toggle.execute({ pack, markerId: 'nope' });
    expect(result.ok ? undefined : result.error.code).toBe('marker.notFound');
    expect(s.progress.saves).toBe(0);
  });
});

describe('personal markers', () => {
  it('adds a pin with a generated id, trimmed text and a timestamp', async () => {
    const s = setup();
    const result = await s.addPin.execute({
      pack,
      mapId: 'overworld',
      position: { x: 100, y: 200 },
      name: '  Camp  ',
      note: '  ',
    });
    expect(result.ok && result.value.marker).toEqual({
      id: 'custom-0001',
      map: 'overworld',
      position: { x: 100, y: 200 },
      name: 'Camp',
      createdAt: NOW,
    });
    expect((await s.progress.load(pack.id))?.customMarkers).toHaveLength(1);
  });

  it('validates map, position, name and note', async () => {
    const s = setup();
    const base = { pack, mapId: 'overworld', position: { x: 1, y: 1 }, name: 'ok' };
    const codes = await Promise.all([
      s.addPin.execute({ ...base, mapId: 'moon' }),
      s.addPin.execute({ ...base, position: { x: -5, y: 1 } }),
      s.addPin.execute({ ...base, name: '   ' }),
      s.addPin.execute({ ...base, name: 'x'.repeat(201) }),
      s.addPin.execute({ ...base, note: 'x'.repeat(2001) }),
    ]);
    expect(codes.map((r) => (r.ok ? 'ok' : r.error.code))).toEqual([
      'map.notFound',
      'input.invalid',
      'input.invalid',
      'input.invalid',
      'input.invalid',
    ]);
    expect(s.progress.saves).toBe(0);
  });

  it('edits and removes pins', async () => {
    const s = setup();
    await s.addPin.execute({
      pack,
      mapId: 'caves',
      position: { x: 5, y: 5 },
      name: 'Gem',
      note: 'shiny',
    });
    const updated = await s.updatePin.execute({
      pack,
      markerId: 'custom-0001',
      changes: { name: ' Big gem ', note: '', position: { x: 6, y: 7 } },
    });
    expect(updated.ok && updated.value.marker).toMatchObject({
      name: 'Big gem',
      note: '',
      position: { x: 6, y: 7 },
    });

    const removed = await s.removePin.execute({ packId: pack.id, markerId: 'custom-0001' });
    expect(removed.ok && removed.value.customMarkers).toEqual([]);
  });

  it('rejects bad edits and unknown pins', async () => {
    const s = setup();
    await s.addPin.execute({ pack, mapId: 'caves', position: { x: 5, y: 5 }, name: 'Gem' });
    const edit = (changes: Parameters<UpdatePersonalMarker['execute']>[0]['changes']) =>
      s.updatePin.execute({ pack, markerId: 'custom-0001', changes });
    const results = await Promise.all([
      edit({ name: '' }),
      edit({ note: 'x'.repeat(2001) }),
      edit({ position: { x: 99999, y: 0 } }),
      s.updatePin.execute({ pack, markerId: 'nope', changes: { name: 'x' } }),
      s.removePin.execute({ packId: pack.id, markerId: 'nope' }),
    ]);
    expect(results.map((r) => (r.ok ? 'ok' : r.error.code))).toEqual([
      'input.invalid',
      'input.invalid',
      'input.invalid',
      'personalMarker.notFound',
      'personalMarker.notFound',
    ]);
  });
});

describe('SaveFilterState and SaveLastView', () => {
  it('persist normalized filters and the viewport', async () => {
    const s = setup();
    await s.saveFilter.execute({
      packId: pack.id,
      filters: { hiddenNodeIds: ['relics', 'chest-common', 'relics'], hideCollected: true },
    });
    expect((await s.progress.load(pack.id))?.filters).toEqual(
      createFilterState(['chest-common', 'relics'], true),
    );
    const view = { map: 'caves', center: { x: 10, y: 20 }, zoom: 2 };
    await s.saveView.execute({ pack, view });
    expect((await s.progress.load(pack.id))?.lastView).toEqual(view);
  });

  it('refuses a view on an unknown map', async () => {
    const s = setup();
    const result = await s.saveView.execute({
      pack,
      view: { map: 'moon', center: { x: 0, y: 0 }, zoom: 0 },
    });
    expect(result.ok ? undefined : result.error.code).toBe('map.notFound');
  });
});

describe('ResetProgress', () => {
  it('previews counts, then clears progress but keeps the last view', async () => {
    const s = setup();
    await s.progress.save(sampleProgressRecord(pack.id));
    expect(await s.reset.preview({ packId: pack.id })).toEqual({
      collected: 2,
      customMarkers: 1,
      hiddenCategories: 1,
    });
    const result = await s.reset.execute({ packId: pack.id });
    expect(result.ok && result.value.cleared).toEqual({
      collected: 2,
      customMarkers: 1,
      hiddenCategories: 1,
    });
    const stored = await s.progress.load(pack.id);
    expect(stored?.collected).toEqual({});
    expect(stored?.customMarkers).toEqual([]);
    expect(stored?.lastView?.map).toBe('overworld');
  });

  it('does nothing for a pack without progress', async () => {
    const s = setup();
    expect(await s.reset.preview({ packId: pack.id })).toEqual({
      collected: 0,
      customMarkers: 0,
      hiddenCategories: 0,
    });
    const result = await s.reset.execute({ packId: pack.id });
    expect(result.ok && result.value.progress).toBeUndefined();
    expect(s.progress.saves).toBe(0);
  });
});

describe('ExportProgress and ImportProgress', () => {
  it('exports JSON with a suggested file name', async () => {
    const s = setup();
    await s.toggle.execute({ pack, markerId: 'ow-chest-001' });
    const result = await s.exportProgress.execute({ pack });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.fileName).toBe(`${pack.id}-progress-2026-11-09.json`);
    expect(JSON.parse(result.value.json)).toEqual(result.value.data);
    expect(result.value.data).toMatchObject({
      packId: pack.id,
      packVersion: '1.0.0',
      exportedAt: NOW,
    });
  });

  it('round-trips through export and replace-import into a fresh store', async () => {
    const source = setup();
    await source.toggle.execute({ pack, markerId: 'cv-relic-001' });
    await source.addPin.execute({ pack, mapId: 'caves', position: { x: 1, y: 1 }, name: 'Pin' });
    const exported = await source.exportProgress.execute({ pack });
    if (!exported.ok) {
      throw new Error('export failed');
    }

    const target = setup();
    const imported = await target.importProgress.execute({
      pack,
      data: exported.value.data,
      mode: 'replace',
    });
    expect(imported.ok).toBe(true);
    const stored = await target.progress.load(pack.id);
    expect(stored?.collected).toEqual({ 'cv-relic-001': NOW });
    expect(stored?.customMarkers.map((m) => m.name)).toEqual(['Pin']);
  });

  it('refuses progress exported from a different pack and changes nothing', async () => {
    const s = setup();
    await s.progress.save(sampleProgressRecord(pack.id));
    const saves = s.progress.saves;
    const result = await s.importProgress.execute({
      pack,
      mode: 'merge',
      data: {
        formatVersion: 1,
        packId: 'com.example.other-game',
        packVersion: '1.0.0',
        exportedAt: NOW,
        collected: { 'ow-chest-002': NOW },
        customMarkers: [],
        filters: { hiddenNodeIds: [], hideCollected: false },
      },
    });
    expect(result.ok ? undefined : result.error.code).toBe('progress.wrongPack');
    expect(result.ok ? '' : result.error.message).toContain('com.example.other-game');
    expect(s.progress.saves).toBe(saves);
    expect((await s.progress.load(pack.id))?.collected).toEqual(
      sampleProgressRecord(pack.id).collected,
    );
  });
});
