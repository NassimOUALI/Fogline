import { findMarker, type Pack } from '../../domain/pack';
import { isCollected, setCollected, type Progress } from '../../domain/progress';
import { fail, ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { ProgressStore } from '../../ports/progress-store';
import { loadOrCreateProgress } from '../shared';

export interface ToggleCollectedDeps {
  readonly progress: ProgressStore;
  readonly clock: Clock;
}

/** Mark collected / unmark. Pass `collected` to set a value instead of toggling. */
export class ToggleCollected {
  constructor(private readonly deps: ToggleCollectedDeps) {}

  async execute(input: {
    readonly pack: Pack;
    readonly markerId: string;
    readonly collected?: boolean | undefined;
  }): Promise<Result<{ readonly progress: Progress; readonly collected: boolean }>> {
    if (findMarker(input.pack, input.markerId) === undefined) {
      return fail(
        'marker.notFound',
        `Marker "${input.markerId}" is not in pack "${input.pack.id}".`,
      );
    }
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const target = input.collected ?? !isCollected(current, input.markerId);
    const progress = setCollected(current, input.markerId, target, now);
    if (progress !== current) {
      await this.deps.progress.save(progress);
    }
    return ok({ progress, collected: target });
  }
}
