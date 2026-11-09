import { emptyProgress, type Progress } from '../domain/progress';
import type { ProgressStore } from '../ports/progress-store';

/** Stored progress for the pack, or a fresh empty one (not saved until something changes). */
export async function loadOrCreateProgress(
  store: Pick<ProgressStore, 'load'>,
  packId: string,
  now: string,
): Promise<Progress> {
  return (await store.load(packId)) ?? emptyProgress(packId, now);
}

export function notInLibrary(packId: string): string {
  return `No pack with id "${packId}" is in the library.`;
}
