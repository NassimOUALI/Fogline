import type { ValidationIssue } from '@fogline/pack-format';
import { describe, expect, it } from 'vitest';
import { emptyProgress, setCollected } from '../../domain/progress';
import { sampleLibraryEntry, sampleProgressRecord } from '../../testing/contracts';
import { FixedClock, InMemoryFileSystem, InMemoryPackReader } from '../../testing/in-memory-io';
import { InMemoryLibraryRepository, InMemoryProgressStore } from '../../testing/in-memory-stores';
import { samplePack } from '../../testing/sample-pack';
import { DeletePackFiles } from './delete-pack-files';
import { ImportPack } from './import-pack';
import { ListLibrary } from './list-library';
import { OpenPack } from './open-pack';
import { RelinkPack } from './relink-pack';
import { RemoveFromLibrary } from './remove-from-library';

const NOW = '2026-11-09T12:00:00.000Z';
const PACK_DIR = 'D:/Packs/sample';
const pack = samplePack();

const warning: ValidationIssue = {
  severity: 'warning',
  path: 'markers.overworld[0].position',
  code: 'marker.outOfBounds',
  message: 'Marker outside map',
};
const error: ValidationIssue = {
  severity: 'error',
  path: 'manifest.license',
  code: 'schema.invalid',
  message: 'Required',
};

function setup() {
  const library = new InMemoryLibraryRepository();
  const progress = new InMemoryProgressStore();
  const reader = new InMemoryPackReader().addPack(PACK_DIR, pack, [warning]);
  const files = new InMemoryFileSystem({ paths: [PACK_DIR] });
  const clock = new FixedClock(NOW);
  return {
    library,
    progress,
    reader,
    files,
    clock,
    importPack: new ImportPack({ reader, library, storage: files, files, clock }),
    openPack: new OpenPack({ library, reader, progress, files, clock }),
    relink: new RelinkPack({ library, reader, files }),
    remove: new RemoveFromLibrary({ library, progress }),
    deleteFiles: new DeletePackFiles({ library, reader, files, progress }),
    list: new ListLibrary({ library, files, progress }),
  };
}

describe('ImportPack', () => {
  it('references a valid folder in place and returns its warnings', async () => {
    const s = setup();
    const outcome = await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') {
      return;
    }
    expect(outcome.warnings).toEqual([warning]);
    expect(outcome.entry).toMatchObject({
      packId: pack.id,
      path: PACK_DIR,
      source: 'referenced',
      importedAt: NOW,
      markerCount: 9,
      status: 'available',
    });
    expect(await s.library.get(pack.id)).toEqual(outcome.entry);
    expect(s.files.granted).toEqual([PACK_DIR]);
    expect(s.files.copies).toEqual([]);
  });

  it('blocks invalid packs and adds nothing', async () => {
    const s = setup();
    s.reader.addInvalid('D:/broken', [error], { warnings: [warning] });
    const outcome = await s.importPack.execute({ location: 'D:/broken', kind: 'folder' });
    expect(outcome).toEqual({ status: 'invalid', errors: [error], warnings: [warning] });
    expect(await s.library.list()).toEqual([]);
    expect(s.files.granted).toEqual([]);
  });

  it('copies a folder into the library when asked, after validating it', async () => {
    const s = setup();
    const outcome = await s.importPack.execute({
      location: PACK_DIR,
      kind: 'folder',
      copyIntoLibrary: true,
    });
    expect(outcome.status).toBe('imported');
    expect(s.files.copies).toEqual([{ from: PACK_DIR, to: `/app-data/library/${pack.id}` }]);
    expect((await s.library.get(pack.id))?.source).toBe('copied');
    expect(s.files.granted).toEqual([]);
  });

  it('extracts archives, and discards the extraction when invalid', async () => {
    const s = setup();
    const extracted = s.files.nextExtractedPath();
    s.reader.addPack(extracted, pack);
    const outcome = await s.importPack.execute({
      location: 'C:/dl/sample.fogpack',
      kind: 'archive',
    });
    expect(outcome.status).toBe('imported');
    expect(await s.library.get(pack.id)).toMatchObject({ path: extracted, source: 'copied' });

    const bad = setup();
    bad.reader.addInvalid(bad.files.nextExtractedPath(), [error]);
    const failed = await bad.importPack.execute({ location: 'C:/dl/bad.fogpack', kind: 'archive' });
    expect(failed.status).toBe('invalid');
    expect(bad.files.discarded).toEqual([bad.files.nextExtractedPath().replace('-2', '-1')]);
  });

  it('asks before replacing a pack with the same id', async () => {
    const s = setup();
    await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    const v2 = samplePack({ version: '2.0.0' });
    s.reader.addPack('E:/new', v2);
    const outcome = await s.importPack.execute({ location: 'E:/new', kind: 'folder' });
    expect(outcome.status).toBe('needsConfirmation');
    if (outcome.status === 'needsConfirmation') {
      expect(outcome.existing.version).toBe('1.0.0');
      expect(outcome.incoming).toEqual({ version: '2.0.0', title: 'Sample Game - Complete Map' });
    }
    expect((await s.library.get(pack.id))?.path).toBe(PACK_DIR);
  });

  it('updates on confirmation and keeps progress untouched', async () => {
    const s = setup();
    await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    const saved = setCollected(emptyProgress(pack.id, NOW), 'ow-chest-001', true, NOW);
    await s.progress.save(saved);
    s.clock.advance(60_000);
    s.reader.addPack('E:/new', samplePack({ version: '2.0.0' }));

    const outcome = await s.importPack.execute({
      location: 'E:/new',
      kind: 'folder',
      ifExists: 'update',
    });
    expect(outcome.status).toBe('updated');
    const entry = await s.library.get(pack.id);
    expect(entry).toMatchObject({ version: '2.0.0', path: 'E:/new', importedAt: NOW });
    expect(await s.progress.load(pack.id)).toEqual(saved);
    expect(s.files.trashed).toEqual([]); // a referenced folder is the user's, never trashed
  });

  it('trashes the old app-owned copy when an update replaces it', async () => {
    const s = setup();
    await s.library.save(
      sampleLibraryEntry(pack.id, { path: '/app-data/library/extracted-old', source: 'copied' }),
    );
    s.files.addPath('/app-data/library/extracted-old');
    s.reader.addPack(s.files.nextExtractedPath(), samplePack({ version: '2.0.0' }));
    const outcome = await s.importPack.execute({
      location: 'C:/dl/v2.fogpack',
      kind: 'archive',
      ifExists: 'update',
    });
    expect(outcome.status).toBe('updated');
    expect(s.files.trashed).toEqual(['/app-data/library/extracted-old']);
  });

  it('discards an extracted archive when the user still has to confirm', async () => {
    const s = setup();
    await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    const extracted = s.files.nextExtractedPath();
    s.reader.addPack(extracted, pack);
    const outcome = await s.importPack.execute({
      location: 'C:/dl/again.fogpack',
      kind: 'archive',
    });
    expect(outcome.status).toBe('needsConfirmation');
    expect(s.files.discarded).toEqual([extracted]);
  });
});

describe('ListLibrary', () => {
  it('sorts by last opened, recomputes availability and reports progress', async () => {
    const s = setup();
    await s.library.save(
      sampleLibraryEntry('a', {
        path: PACK_DIR,
        lastOpenedAt: '2026-01-01T00:00:00Z',
        status: 'missing',
        markerCount: 2,
      }),
    );
    await s.library.save(
      sampleLibraryEntry('b', { path: 'E:/gone', lastOpenedAt: '2026-06-01T00:00:00Z' }),
    );
    await s.progress.save(
      sampleProgressRecord('a', {
        collected: { x: NOW, y: NOW, stale: NOW }, // 3 collected, capped at 2
      }),
    );

    const cards = await s.list.execute();
    expect(
      cards.map((card) => [card.entry.packId, card.entry.status, card.collected, card.total]),
    ).toEqual([
      ['b', 'missing', 0, 9],
      ['a', 'available', 2, 2],
    ]);
    expect((await s.library.get('a'))?.status).toBe('available');
    expect((await s.library.get('b'))?.status).toBe('missing');
  });

  it('survives a restart: a new instance over the same repositories lists the same packs', async () => {
    const s = setup();
    await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    const again = new ListLibrary({ library: s.library, files: s.files, progress: s.progress });
    expect((await again.execute()).map((card) => card.entry.packId)).toEqual([pack.id]);
  });
});

describe('OpenPack', () => {
  it('loads the pack with fresh progress and records the open', async () => {
    const s = setup();
    await s.importPack.execute({ location: PACK_DIR, kind: 'folder' });
    s.clock.set('2026-11-10T08:00:00.000Z');
    const result = await s.openPack.execute({ packId: pack.id });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.pack).toBe(pack);
    expect(result.value.progress.packVersionSeen).toBe('1.0.0');
    expect(result.value.packUpdated).toBe(false);
    expect(result.value.warnings).toEqual([warning]);
    expect((await s.library.get(pack.id))?.lastOpenedAt).toBe('2026-11-10T08:00:00.000Z');
    expect((await s.progress.load(pack.id))?.packVersionSeen).toBe('1.0.0');
  });

  it('reports a pack update and the collected markers it removed', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(
      sampleProgressRecord(pack.id, {
        packVersionSeen: '0.9.0',
        collected: { 'ow-chest-001': NOW, 'removed-001': NOW },
      }),
    );
    const result = await s.openPack.execute({ packId: pack.id });
    expect(result.ok && result.value.packUpdated).toBe(true);
    expect(result.ok && result.value.staleMarkerIds).toEqual(['removed-001']);
    expect(Object.keys((await s.progress.load(pack.id))?.collected ?? {})).toHaveLength(2);
  });

  it('does not rewrite progress when the version is unchanged', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(sampleProgressRecord(pack.id, { packVersionSeen: '1.0.0' }));
    const before = s.progress.saves;
    await s.openPack.execute({ packId: pack.id });
    expect(s.progress.saves).toBe(before);
  });

  it('marks a moved pack as missing', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'E:/moved-away' }));
    const result = await s.openPack.execute({ packId: pack.id });
    expect(result.ok ? undefined : result.error.code).toBe('pack.unavailable');
    expect((await s.library.get(pack.id))?.status).toBe('missing');
  });

  it('refuses unknown, invalid and swapped packs', async () => {
    const s = setup();
    expect((await s.openPack.execute({ packId: 'nope' })).ok).toBe(false);

    s.files.addPath('D:/now-broken', 'D:/swapped');
    s.reader.addInvalid('D:/now-broken', [error], { packId: pack.id });
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'D:/now-broken' }));
    const invalid = await s.openPack.execute({ packId: pack.id });
    expect(invalid.ok ? undefined : invalid.error).toMatchObject({
      code: 'pack.invalid',
      issues: [error],
    });

    s.reader.addPack('D:/swapped', samplePack({ id: 'com.example.other' }));
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'D:/swapped' }));
    const swapped = await s.openPack.execute({ packId: pack.id });
    expect(swapped.ok ? undefined : swapped.error.code).toBe('pack.idMismatch');
  });
});

describe('RelinkPack (Locate)', () => {
  it('accepts a folder with the same pack id and keeps progress', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'E:/old', status: 'missing' }));
    const progress = sampleProgressRecord(pack.id);
    await s.progress.save(progress);
    s.reader.addPack('F:/moved/sample', pack);

    const result = await s.relink.execute({ packId: pack.id, location: 'F:/moved/sample' });
    expect(result.ok && result.value).toMatchObject({
      path: 'F:/moved/sample',
      status: 'available',
    });
    expect((await s.library.get(pack.id))?.path).toBe('F:/moved/sample');
    expect(s.files.granted).toEqual(['F:/moved/sample']);
    expect(await s.progress.load(pack.id)).toEqual(progress);
  });

  it('refuses a folder holding a different pack', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'E:/old', status: 'missing' }));
    s.reader.addPack('F:/other', samplePack({ id: 'com.example.other' }));
    const result = await s.relink.execute({ packId: pack.id, location: 'F:/other' });
    expect(result.ok ? undefined : result.error.code).toBe('pack.idMismatch');
    expect(result.ok ? '' : result.error.message).toContain('com.example.other');
    expect((await s.library.get(pack.id))?.path).toBe('E:/old');
    expect(s.files.granted).toEqual([]);
  });

  it('refuses a folder without a manifest and unknown packs', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'E:/old' }));
    const empty = await s.relink.execute({ packId: pack.id, location: 'F:/empty' });
    expect(empty.ok ? undefined : empty.error.code).toBe('pack.notFound');
    const unknown = await s.relink.execute({ packId: 'nope', location: PACK_DIR });
    expect(unknown.ok ? undefined : unknown.error.code).toBe('library.notFound');
  });
});

describe('RemoveFromLibrary', () => {
  it('removes the entry but keeps files and, by default, progress', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(sampleProgressRecord(pack.id));
    const result = await s.remove.execute({ packId: pack.id });
    expect(result.ok && result.value.progressCleared).toBe(false);
    expect(await s.library.get(pack.id)).toBeUndefined();
    expect(await s.progress.load(pack.id)).toBeDefined();
    expect(await s.files.exists(PACK_DIR)).toBe(true);
    expect(s.files.trashed).toEqual([]);
  });

  it('also clears progress when asked, and refuses unknown packs', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(sampleProgressRecord(pack.id));
    await s.remove.execute({ packId: pack.id, clearProgress: true });
    expect(await s.progress.load(pack.id)).toBeUndefined();
    expect((await s.remove.execute({ packId: pack.id })).ok).toBe(false);
  });
});

describe('DeletePackFiles', () => {
  it('trashes exactly the registered folder and removes the entry, keeping progress', async () => {
    const s = setup();
    s.files.addPath('D:/Packs', 'D:/Packs/other-pack');
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(sampleProgressRecord(pack.id));

    const result = await s.deleteFiles.execute({ packId: pack.id });
    expect(result.ok && result.value).toEqual({ trashedPath: PACK_DIR, progressCleared: false });
    expect(s.files.trashed).toEqual([PACK_DIR]);
    expect(await s.files.exists('D:/Packs')).toBe(true);
    expect(await s.files.exists('D:/Packs/other-pack')).toBe(true);
    expect(await s.library.get(pack.id)).toBeUndefined();
    expect(await s.progress.load(pack.id)).toBeDefined();
  });

  it('can also clear progress', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: PACK_DIR }));
    await s.progress.save(sampleProgressRecord(pack.id));
    await s.deleteFiles.execute({ packId: pack.id, clearProgress: true });
    expect(await s.progress.load(pack.id)).toBeUndefined();
  });

  it('refuses when the registered folder no longer holds this pack', async () => {
    const s = setup();
    s.files.addPath('D:/Games');
    s.reader.addPack('D:/Games', samplePack({ id: 'com.example.other' }));
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'D:/Games' }));
    const swapped = await s.deleteFiles.execute({ packId: pack.id });
    expect(swapped.ok ? undefined : swapped.error.code).toBe('pack.notSafeToDelete');

    s.files.addPath('D:/NoManifest');
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'D:/NoManifest' }));
    const noManifest = await s.deleteFiles.execute({ packId: pack.id });
    expect(noManifest.ok ? undefined : noManifest.error.code).toBe('pack.notSafeToDelete');

    expect(s.files.trashed).toEqual([]);
    expect(await s.library.get(pack.id)).toBeDefined();
  });

  it('refuses missing folders and unknown packs without touching anything', async () => {
    const s = setup();
    await s.library.save(sampleLibraryEntry(pack.id, { path: 'E:/gone' }));
    const missing = await s.deleteFiles.execute({ packId: pack.id });
    expect(missing.ok ? undefined : missing.error.code).toBe('pack.unavailable');
    const unknown = await s.deleteFiles.execute({ packId: 'nope' });
    expect(unknown.ok ? undefined : unknown.error.code).toBe('library.notFound');
    expect(s.files.trashed).toEqual([]);
  });
});
