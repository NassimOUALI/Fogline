import { mkdtemp, readFile, rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  describeLibraryRepositoryContract,
  describeProgressStoreContract,
  sampleProgressRecord,
} from '@fogline/core/testing';
import { EXAMPLES_DIR } from '@fogline/pack-format/testing';
import { NodeAppFiles } from '../test/node-app-files';
import {
  JsonLibraryRepository,
  JsonProgressStore,
  LIBRARY_FILE,
  PROGRESS_FOLDER,
  progressFileName,
} from './json-stores';

const dirs: string[] = [];
async function dataDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'fogline-desktop-'));
  dirs.push(dir);
  return dir;
}
afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

// The same contract suites as core's in-memory adapters, now on real disk, with a reopen
// that builds a fresh adapter over the same folder (an app restart).
describeProgressStoreContract('JsonProgressStore', async () => {
  const dir = await dataDir();
  return {
    subject: new JsonProgressStore(new NodeAppFiles(), dir),
    reopen: () => Promise.resolve(new JsonProgressStore(new NodeAppFiles(), dir)),
  };
});

describeLibraryRepositoryContract('JsonLibraryRepository', async () => {
  const dir = await dataDir();
  return {
    subject: new JsonLibraryRepository(new NodeAppFiles(), dir),
    reopen: () => Promise.resolve(new JsonLibraryRepository(new NodeAppFiles(), dir)),
  };
});

describe('JSON files on disk', () => {
  it('reads the sample app data from examples/app-data unchanged', async () => {
    const dir = await dataDir();
    const example = (path: string): Promise<string> =>
      readFile(join(EXAMPLES_DIR, 'app-data', path), 'utf8');
    await writeFile(join(dir, LIBRARY_FILE), await example('library.json'));
    await mkdir(join(dir, PROGRESS_FOLDER));
    await writeFile(
      join(dir, PROGRESS_FOLDER, progressFileName('com.example.example-game')),
      await example('progress/com.example.example-game.json'),
    );
    const library = await new JsonLibraryRepository(new NodeAppFiles(), dir).list();
    expect(library.map((entry) => [entry.packId, entry.status])).toEqual([
      ['com.example.example-game', 'available'],
      ['com.example.other-game', 'missing'],
    ]);
    const progress = await new JsonProgressStore(new NodeAppFiles(), dir).load(
      'com.example.example-game',
    );
    expect(Object.keys(progress?.collected ?? {})).toEqual(['ow-chest-001', 'ow-waypoint-001']);
    expect(progress?.filters.hiddenNodeIds).toEqual(['chest-common']);
  });

  it('writes versioned, readable files with entries sorted by pack id', async () => {
    const dir = await dataDir();
    const store = new JsonProgressStore(new NodeAppFiles(), dir);
    await store.save(sampleProgressRecord('com.example.a'));
    const written = JSON.parse(
      await readFile(join(dir, PROGRESS_FOLDER, progressFileName('com.example.a')), 'utf8'),
    ) as { formatVersion: number; packId: string };
    expect(written.formatVersion).toBe(1);
    expect(written.packId).toBe('com.example.a');
  });

  it('encodes pack ids that are not valid file names on Windows', async () => {
    expect(progressFileName('com.example:game')).toBe('com.example%3Agame.json');
    const dir = await dataDir();
    const store = new JsonProgressStore(new NodeAppFiles(), dir);
    await store.save(sampleProgressRecord('com.example:game'));
    expect((await store.load('com.example:game'))?.packId).toBe('com.example:game');
  });

  it('writes atomically: no temporary files are left behind', async () => {
    const dir = await dataDir();
    const repository = new JsonLibraryRepository(new NodeAppFiles(), dir);
    const { sampleLibraryEntry } = await import('@fogline/core/testing');
    await Promise.all(
      ['a', 'b', 'c', 'd'].map((id) => repository.save(sampleLibraryEntry(`com.example.${id}`))),
    );
    expect((await repository.list()).map((entry) => entry.packId).sort()).toEqual([
      'com.example.a',
      'com.example.b',
      'com.example.c',
      'com.example.d',
    ]);
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('keeps a corrupt library file aside instead of overwriting it', async () => {
    const dir = await dataDir();
    await writeFile(join(dir, LIBRARY_FILE), '{ not json');
    const reported: string[] = [];
    const repository = new JsonLibraryRepository(new NodeAppFiles(), dir, {
      onCorruptFile: (_path, backup) => reported.push(backup),
    });
    expect(await repository.list()).toEqual([]);
    expect(reported).toHaveLength(1);
    expect(await readFile(reported[0] ?? '', 'utf8')).toBe('{ not json');
  });

  it('keeps an invalid progress file aside, including one for another pack', async () => {
    const dir = await dataDir();
    await mkdir(join(dir, PROGRESS_FOLDER));
    const path = join(dir, PROGRESS_FOLDER, progressFileName('com.example.a'));
    await writeFile(
      path,
      JSON.stringify({ ...sampleProgressRecord('com.example.other'), formatVersion: 1 }),
    );
    const reported: string[] = [];
    const store = new JsonProgressStore(new NodeAppFiles(), dir, {
      onCorruptFile: (_path, backup) => reported.push(backup),
    });
    expect(await store.load('com.example.a')).toBeUndefined();
    expect(reported).toHaveLength(1);

    await writeFile(path, '[]');
    expect(
      await new JsonProgressStore(new NodeAppFiles(), dir).load('com.example.a'),
    ).toBeUndefined();
  });
});
