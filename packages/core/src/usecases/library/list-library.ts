import { sortByRecent, withStatus, type LibraryEntry } from '../../domain/library';
import type { PathChecker } from '../../ports/file-system';
import type { LibraryRepository } from '../../ports/library-repository';
import type { ProgressStore } from '../../ports/progress-store';

export interface LibraryCard {
  readonly entry: LibraryEntry;
  /** Collected markers, capped at `total`. */
  readonly collected: number;
  /** Cached marker count of the pack. */
  readonly total: number;
}

export interface ListLibraryDeps {
  readonly library: LibraryRepository;
  readonly files: PathChecker;
  readonly progress: Pick<ProgressStore, 'load'>;
}

/**
 * Home screen data: every pack, most recently opened first, with availability recomputed and
 * persisted, and progress counts.
 *
 * The collected count comes from the progress file alone, without opening the pack, so it can
 * include markers a pack update removed; it is capped at the cached total for that reason.
 */
export class ListLibrary {
  constructor(private readonly deps: ListLibraryDeps) {}

  async execute(): Promise<LibraryCard[]> {
    const entries = await this.deps.library.list();
    const refreshed: LibraryEntry[] = [];
    for (const entry of entries) {
      const status = (await this.deps.files.exists(entry.path)) ? 'available' : 'missing';
      if (status === entry.status) {
        refreshed.push(entry);
      } else {
        const changed = withStatus(entry, status);
        await this.deps.library.save(changed);
        refreshed.push(changed);
      }
    }
    const cards: LibraryCard[] = [];
    for (const entry of sortByRecent(refreshed)) {
      const progress = await this.deps.progress.load(entry.packId);
      const collected = progress === undefined ? 0 : Object.keys(progress.collected).length;
      cards.push({
        entry,
        collected: Math.min(collected, entry.markerCount),
        total: entry.markerCount,
      });
    }
    return cards;
  }
}
