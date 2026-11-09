import {
  resetProgress,
  summarizeProgress,
  type Progress,
  type ProgressSummary,
} from '../../domain/progress';
import { ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { ProgressStore } from '../../ports/progress-store';

const NOTHING: ProgressSummary = { collected: 0, customMarkers: 0, hiddenCategories: 0 };

export interface ResetProgressDeps {
  readonly progress: ProgressStore;
  readonly clock: Clock;
}

/**
 * Clears collected markers, personal pins and filters for one pack. The pack and its library
 * entry are untouched. `preview` returns the counts the strong confirmation dialog shows.
 */
export class ResetProgress {
  constructor(private readonly deps: ResetProgressDeps) {}

  async preview(input: { readonly packId: string }): Promise<ProgressSummary> {
    const stored = await this.deps.progress.load(input.packId);
    return stored === undefined ? NOTHING : summarizeProgress(stored);
  }

  async execute(input: {
    readonly packId: string;
  }): Promise<
    Result<{ readonly progress?: Progress | undefined; readonly cleared: ProgressSummary }>
  > {
    const stored = await this.deps.progress.load(input.packId);
    if (stored === undefined) {
      return ok({ cleared: NOTHING });
    }
    const progress = resetProgress(stored, nowIso(this.deps.clock));
    await this.deps.progress.save(progress);
    return ok({ progress, cleared: summarizeProgress(stored) });
  }
}
