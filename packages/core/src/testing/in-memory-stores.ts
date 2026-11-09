import type { LibraryEntry } from '../domain/library';
import type { Progress } from '../domain/progress';
import type { LibraryRepository } from '../ports/library-repository';
import type { ProgressStore } from '../ports/progress-store';

/**
 * Library registry held in memory. Stores and returns copies, like a real persistence layer,
 * so callers cannot mutate stored state by accident.
 */
export class InMemoryLibraryRepository implements LibraryRepository {
  private readonly entries = new Map<string, LibraryEntry>();

  constructor(initial: readonly LibraryEntry[] = []) {
    for (const entry of initial) {
      this.entries.set(entry.packId, structuredClone(entry));
    }
  }

  list(): Promise<readonly LibraryEntry[]> {
    return Promise.resolve([...this.entries.values()].map((entry) => structuredClone(entry)));
  }

  get(packId: string): Promise<LibraryEntry | undefined> {
    const entry = this.entries.get(packId);
    return Promise.resolve(entry === undefined ? undefined : structuredClone(entry));
  }

  save(entry: LibraryEntry): Promise<void> {
    this.entries.set(entry.packId, structuredClone(entry));
    return Promise.resolve();
  }

  remove(packId: string): Promise<void> {
    this.entries.delete(packId);
    return Promise.resolve();
  }
}

/** Progress store held in memory; stores and returns copies. */
export class InMemoryProgressStore implements ProgressStore {
  private readonly records = new Map<string, Progress>();
  /** Number of `save` calls, for asserting that no-op actions do not write. */
  saves = 0;

  constructor(initial: readonly Progress[] = []) {
    for (const progress of initial) {
      this.records.set(progress.packId, structuredClone(progress));
    }
  }

  load(packId: string): Promise<Progress | undefined> {
    const progress = this.records.get(packId);
    return Promise.resolve(progress === undefined ? undefined : structuredClone(progress));
  }

  save(progress: Progress): Promise<void> {
    this.saves += 1;
    this.records.set(progress.packId, structuredClone(progress));
    return Promise.resolve();
  }

  delete(packId: string): Promise<void> {
    this.records.delete(packId);
    return Promise.resolve();
  }
}
