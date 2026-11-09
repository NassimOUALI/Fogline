import type { Progress } from '../domain/progress';

/**
 * Persists per-pack progress (collected markers, personal pins, filters, last view), keyed by
 * pack id. Implementations must pass `describeProgressStoreContract` from `@fogline/core/testing`.
 */
export interface ProgressStore {
  load(packId: string): Promise<Progress | undefined>;
  /** Inserts, or replaces the progress with the same `packId`. */
  save(progress: Progress): Promise<void>;
  /** Deleting unknown progress is a no-op. */
  delete(packId: string): Promise<void>;
}
