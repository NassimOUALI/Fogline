import type { LibraryEntry } from '../domain/library';

/**
 * Persists the registry of known packs. Implementations must pass
 * `describeLibraryRepositoryContract` from `@fogline/core/testing`.
 */
export interface LibraryRepository {
  /** Every entry, in no particular order. */
  list(): Promise<readonly LibraryEntry[]>;
  get(packId: string): Promise<LibraryEntry | undefined>;
  /** Inserts, or replaces the entry with the same `packId`. */
  save(entry: LibraryEntry): Promise<void>;
  /** Removing an unknown id is a no-op. */
  remove(packId: string): Promise<void>;
}
