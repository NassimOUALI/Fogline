import { fail, ok, type Result } from '../../domain/result';
import type { PathChecker, Trash } from '../../ports/file-system';
import type { LibraryRepository } from '../../ports/library-repository';
import type { PackReader } from '../../ports/pack-reader';
import type { ProgressStore } from '../../ports/progress-store';
import { notInLibrary } from '../shared';

export interface DeletionResult {
  /** The folder sent to the trash. */
  readonly trashedPath: string;
  readonly progressCleared: boolean;
}

export interface DeletePackFilesDeps {
  readonly library: LibraryRepository;
  readonly reader: Pick<PackReader, 'readPackId'>;
  readonly files: PathChecker & Trash;
  readonly progress: Pick<ProgressStore, 'delete'>;
}

/**
 * Sends the registered pack folder to the system trash and removes the entry.
 *
 * Safety (assumption A12): only the exact registered path, and only when that folder still
 * holds a manifest with the same pack id. Nothing else is ever touched.
 */
export class DeletePackFiles {
  constructor(private readonly deps: DeletePackFilesDeps) {}

  async execute(input: {
    readonly packId: string;
    readonly clearProgress?: boolean | undefined;
  }): Promise<Result<DeletionResult>> {
    const { library, reader, files, progress } = this.deps;
    const entry = await library.get(input.packId);
    if (entry === undefined) {
      return fail('library.notFound', notInLibrary(input.packId));
    }
    if (!(await files.exists(entry.path))) {
      return fail(
        'pack.unavailable',
        `${entry.path} does not exist, so there is nothing to delete. Use Remove from library instead.`,
      );
    }
    const foundId = await reader.readPackId(entry.path);
    if (foundId !== entry.packId) {
      return fail(
        'pack.notSafeToDelete',
        `Fogline only deletes a folder that contains pack "${entry.packId}", and ${entry.path} does not. Nothing was deleted.`,
      );
    }
    await files.moveToTrash(entry.path);
    await library.remove(entry.packId);
    const progressCleared = input.clearProgress === true;
    if (progressCleared) {
      await progress.delete(entry.packId);
    }
    return ok({ trashedPath: entry.path, progressCleared });
  }
}
