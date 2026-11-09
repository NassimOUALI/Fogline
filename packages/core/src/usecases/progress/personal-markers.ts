import { findMap, isInsideMap, type Pack, type Position } from '../../domain/pack';
import { MAX_PERSONAL_MARKER_NAME, MAX_PERSONAL_MARKER_NOTE } from '../../domain/personal-markers';
import {
  addCustomMarker,
  findCustomMarker,
  removeCustomMarker,
  updateCustomMarker,
  type CustomMarker,
  type CustomMarkerChanges,
  type Progress,
} from '../../domain/progress';
import { fail, ok, type Result } from '../../domain/result';
import { nowIso, type Clock } from '../../ports/clock';
import type { IdGenerator } from '../../ports/id-generator';
import type { ProgressStore } from '../../ports/progress-store';
import { loadOrCreateProgress } from '../shared';

type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

function checkName(name: string): Checked<string> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: 'A personal marker needs a name.' };
  }
  if (trimmed.length > MAX_PERSONAL_MARKER_NAME) {
    return {
      ok: false,
      message: `Names are limited to ${String(MAX_PERSONAL_MARKER_NAME)} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

function checkNote(note: string | undefined): Checked<string | undefined> {
  const trimmed = note?.trim();
  if (trimmed !== undefined && trimmed.length > MAX_PERSONAL_MARKER_NOTE) {
    return {
      ok: false,
      message: `Notes are limited to ${String(MAX_PERSONAL_MARKER_NOTE)} characters.`,
    };
  }
  return { ok: true, value: trimmed === '' ? undefined : trimmed };
}

export interface PersonalMarkerDeps {
  readonly progress: ProgressStore;
  readonly clock: Clock;
}

/** Right-click / long-press: adds a personal pin to one map of the pack. */
export class AddPersonalMarker {
  constructor(private readonly deps: PersonalMarkerDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    readonly pack: Pack;
    readonly mapId: string;
    readonly position: Position;
    readonly name: string;
    readonly note?: string | undefined;
  }): Promise<Result<{ readonly progress: Progress; readonly marker: CustomMarker }>> {
    const map = findMap(input.pack, input.mapId);
    if (map === undefined) {
      return fail('map.notFound', `Map "${input.mapId}" is not in pack "${input.pack.id}".`);
    }
    if (!isInsideMap(map, input.position)) {
      return fail('input.invalid', 'Personal markers must be placed inside the map.');
    }
    const name = checkName(input.name);
    if (!name.ok) {
      return fail('input.invalid', name.message);
    }
    const note = checkNote(input.note);
    if (!note.ok) {
      return fail('input.invalid', note.message);
    }
    const now = nowIso(this.deps.clock);
    const marker: CustomMarker = {
      id: this.deps.ids.next(),
      map: map.id,
      position: { x: input.position.x, y: input.position.y },
      name: name.value,
      ...(note.value === undefined ? {} : { note: note.value }),
      createdAt: now,
    };
    const current = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const progress = addCustomMarker(current, marker, now);
    await this.deps.progress.save(progress);
    return ok({ progress, marker });
  }
}

/** Edits the name, note or position of a personal pin. */
export class UpdatePersonalMarker {
  constructor(private readonly deps: PersonalMarkerDeps) {}

  async execute(input: {
    readonly pack: Pack;
    readonly markerId: string;
    readonly changes: CustomMarkerChanges;
  }): Promise<Result<{ readonly progress: Progress; readonly marker: CustomMarker }>> {
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.pack.id, now);
    const existing = findCustomMarker(current, input.markerId);
    if (existing === undefined) {
      return fail('personalMarker.notFound', `There is no personal marker "${input.markerId}".`);
    }
    const changes: { name?: string; note?: string; position?: Position } = {};
    if (input.changes.name !== undefined) {
      const name = checkName(input.changes.name);
      if (!name.ok) {
        return fail('input.invalid', name.message);
      }
      changes.name = name.value;
    }
    if (input.changes.note !== undefined) {
      const note = checkNote(input.changes.note);
      if (!note.ok) {
        return fail('input.invalid', note.message);
      }
      changes.note = note.value ?? '';
    }
    if (input.changes.position !== undefined) {
      const map = findMap(input.pack, existing.map);
      if (map === undefined || !isInsideMap(map, input.changes.position)) {
        return fail('input.invalid', 'Personal markers must be placed inside the map.');
      }
      changes.position = input.changes.position;
    }
    const progress = updateCustomMarker(current, input.markerId, changes, now);
    const marker = progress === undefined ? undefined : findCustomMarker(progress, input.markerId);
    if (progress === undefined || marker === undefined) {
      return fail('personalMarker.notFound', `There is no personal marker "${input.markerId}".`);
    }
    await this.deps.progress.save(progress);
    return ok({ progress, marker });
  }
}

/** Deletes a personal pin. */
export class RemovePersonalMarker {
  constructor(private readonly deps: PersonalMarkerDeps) {}

  async execute(input: {
    readonly packId: string;
    readonly markerId: string;
  }): Promise<Result<Progress>> {
    const now = nowIso(this.deps.clock);
    const current = await loadOrCreateProgress(this.deps.progress, input.packId, now);
    const progress = removeCustomMarker(current, input.markerId, now);
    if (progress === undefined) {
      return fail('personalMarker.notFound', `There is no personal marker "${input.markerId}".`);
    }
    await this.deps.progress.save(progress);
    return ok(progress);
  }
}
