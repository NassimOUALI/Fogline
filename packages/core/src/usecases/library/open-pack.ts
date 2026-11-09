import type { ValidationIssue } from '@fogline/pack-format';
import {
  markOpened,
  refreshEntryFromPack,
  withStatus,
  type LibraryEntry,
} from '../../domain/library';
import { hasMarker, type Pack } from '../../domain/pack';
import { staleMarkerIds, withPackVersionSeen, type Progress } from '../../domain/progress';
import { fail, ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { PathChecker } from '../../ports/file-system';
import type { LibraryRepository } from '../../ports/library-repository';
import type { PackReader } from '../../ports/pack-reader';
import type { ProgressStore } from '../../ports/progress-store';
import { loadOrCreateProgress, notInLibrary } from '../shared';

export interface OpenedPack {
  readonly pack: Pack;
  readonly progress: Progress;
  readonly entry: LibraryEntry;
  readonly warnings: readonly ValidationIssue[];
  /** The pack version changed since this progress was last used with it. */
  readonly packUpdated: boolean;
  /** Collected ids this pack version no longer contains (kept, ignored by counts). */
  readonly staleMarkerIds: readonly string[];
}

export interface OpenPackDeps {
  readonly library: LibraryRepository;
  readonly reader: Pick<PackReader, 'read'>;
  readonly progress: ProgressStore;
  readonly files: PathChecker;
  readonly clock: Clock;
}

/** Loads a library pack with its progress and records that it was opened. */
export class OpenPack {
  constructor(private readonly deps: OpenPackDeps) {}

  async execute(input: { readonly packId: string }): Promise<Result<OpenedPack>> {
    const { library, reader, progress: store, files, clock } = this.deps;
    const entry = await library.get(input.packId);
    if (entry === undefined) {
      return fail('library.notFound', notInLibrary(input.packId));
    }
    if (!(await files.exists(entry.path))) {
      await library.save(withStatus(entry, 'missing'));
      return fail(
        'pack.unavailable',
        `The pack folder ${entry.path} is no longer there. Use Locate to point to its new place.`,
      );
    }
    const read = await reader.read(entry.path);
    if (!read.ok) {
      return fail('pack.invalid', `The pack at ${entry.path} is no longer valid.`, read.errors);
    }
    const { pack } = read;
    if (pack.id !== entry.packId) {
      return fail(
        'pack.idMismatch',
        `The folder ${entry.path} now contains pack "${pack.id}", not "${entry.packId}".`,
      );
    }

    const now = nowIso(clock);
    let progress = await loadOrCreateProgress(store, pack.id, now);
    const previousVersion = progress.packVersionSeen;
    if (previousVersion !== pack.version) {
      progress = withPackVersionSeen(progress, pack.version, now);
      await store.save(progress);
    }

    const opened = markOpened(refreshEntryFromPack(entry, pack), now);
    await library.save(opened);

    return ok({
      pack,
      progress,
      entry: opened,
      warnings: read.warnings,
      packUpdated: previousVersion !== undefined && previousVersion !== pack.version,
      staleMarkerIds: staleMarkerIds(progress, (id) => hasMarker(pack, id)),
    });
  }
}
