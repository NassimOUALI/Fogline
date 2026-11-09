import type { FilterState } from '../../domain/filter';
import { findMap, type Pack } from '../../domain/pack';
import { withFilters, withLastView, type LastView, type Progress } from '../../domain/progress';
import { fail, ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { ProgressStore } from '../../ports/progress-store';
import { loadOrCreateProgress } from '../shared';

export interface SaveViewStateDeps {
  readonly progress: ProgressStore;
  readonly clock: Clock;
}

/** Persists the filter tree state (hidden leaf ids and hide-collected). */
export class SaveFilterState {
  constructor(private readonly deps: SaveViewStateDeps) {}

  async execute(input: {
    readonly packId: string;
    readonly filters: FilterState;
  }): Promise<Result<Progress>> {
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.packId, now);
    const progress = withFilters(current, input.filters, now);
    await this.deps.progress.save(progress);
    return ok(progress);
  }
}

/** Persists the viewport so reopening the pack resumes where the user was. */
export class SaveLastView {
  constructor(private readonly deps: SaveViewStateDeps) {}

  async execute(input: {
    readonly pack: Pack;
    readonly view: LastView;
  }): Promise<Result<Progress>> {
    if (findMap(input.pack, input.view.map) === undefined) {
      return fail('map.notFound', `Map "${input.view.map}" is not in pack "${input.pack.id}".`);
    }
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const progress = withLastView(current, input.view, now);
    await this.deps.progress.save(progress);
    return ok(progress);
  }
}
