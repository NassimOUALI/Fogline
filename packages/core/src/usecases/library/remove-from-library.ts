import type { LibraryEntry } from '../../domain/library';
import { fail, ok, type Result } from '../../domain/result';
import type { LibraryRepository } from '../../ports/library-repository';
import type { ProgressStore } from '../../ports/progress-store';
import { notInLibrary } from '../shared';

export interface RemovalResult {
  readonly entry: LibraryEntry;
  readonly progressCleared: boolean;
}

export interface RemoveFromLibraryDeps {
  readonly library: LibraryRepository;
  readonly progress: Pick<ProgressStore, 'delete'>;
}

/** Removes the registry entry only. Pack files stay; progress stays unless asked. */
export class RemoveFromLibrary {
  constructor(private readonly deps: RemoveFromLibraryDeps) {}

  async execute(input: {
    readonly packId: string;
    readonly clearProgress?: boolean | undefined;
  }): Promise<Result<RemovalResult>> {
    const entry = await this.deps.library.get(input.packId);
    if (entry === undefined) {
      return fail('library.notFound', notInLibrary(input.packId));
    }
    await this.deps.library.remove(input.packId);
    const progressCleared = input.clearProgress === true;
    if (progressCleared) {
      await this.deps.progress.delete(input.packId);
    }
    return ok({ entry, progressCleared });
  }
}
