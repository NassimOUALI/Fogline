import type { Pack } from '../../domain/pack';
import type { Progress } from '../../domain/progress';
import {
  buildProgressExport,
  importIntoProgress,
  type ImportMode,
  type ImportReport,
  type ProgressExport,
} from '../../domain/progress-transfer';
import { fail, ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { ProgressStore } from '../../ports/progress-store';
import { loadOrCreateProgress } from '../shared';

export interface TransferProgressDeps {
  readonly progress: ProgressStore;
  readonly clock: Clock;
}

export interface ExportedProgress {
  readonly data: ProgressExport;
  /** Pretty-printed JSON, ready to write. */
  readonly json: string;
  /** Suggested file name, e.g. `com.example.game-progress-2026-11-09.json`. */
  readonly fileName: string;
}

/**
 * Produces the progress export for the open pack. Writing the file is left to the caller
 * (assumption A17): core stays free of I/O, and the desktop adapter owns the save dialog.
 */
export class ExportProgress {
  constructor(private readonly deps: TransferProgressDeps) {}

  async execute(input: { readonly pack: Pack }): Promise<Result<ExportedProgress>> {
    const now = nowIso(this.deps.clock);
    const progress = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const data = buildProgressExport(progress, input.pack, now);
    return ok({
      data,
      json: `${JSON.stringify(data, null, 2)}\n`,
      fileName: `${input.pack.id}-progress-${now.slice(0, 10)}.json`,
    });
  }
}

/**
 * Applies an export file to the open pack, by merge or replace. Refuses a file for another
 * pack. The caller parses the file with the pack-format schema first (assumption A17).
 */
export class ImportProgress {
  constructor(private readonly deps: TransferProgressDeps) {}

  async execute(input: {
    readonly pack: Pack;
    readonly data: ProgressExport;
    readonly mode: ImportMode;
  }): Promise<Result<{ readonly progress: Progress; readonly report: ImportReport }>> {
    if (input.data.packId !== input.pack.id) {
      return fail(
        'progress.wrongPack',
        `This file holds progress for pack "${input.data.packId}", but the open pack is "${input.pack.id}". Nothing was imported.`,
      );
    }
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const result = importIntoProgress(current, input.data, input.pack, input.mode, now);
    await this.deps.progress.save(result.progress);
    return ok(result);
  }
}
